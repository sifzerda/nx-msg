// src/app/api/push/send/route.js

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendWebPush } from "@/lib/webPush";

export const runtime = "nodejs";

function validSecret(request) {
  const provided = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "") || "";

  const expected = process.env.PUSH_WEBHOOK_SECRET || "";

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return (
    b.length > 0 &&
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

export async function POST(request) {
  if (!validSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const payload = await request.json();

    if (
      payload.type !== "INSERT" ||
      payload.table !== "messages" ||
      payload.schema !== "public"
    ) {
      return NextResponse.json(
        { error: "Invalid event" },
        { status: 400 }
      );
    }

    const messageId = payload.record?.id;

    if (
      typeof messageId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(messageId)
    ) {
      return NextResponse.json(
        { error: "Invalid message ID" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: message, error: messageError } =
      await admin
        .from("messages")
        .select("id, conversation_id, sender_id")
        .eq("id", messageId)
        .single();

    if (messageError || !message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    const { data: members, error: membersError } =
      await admin
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", message.conversation_id)
        .neq("user_id", message.sender_id);

    if (membersError) throw membersError;

    const recipientIds = (members || []).map(
      (member) => member.user_id
    );

    if (!recipientIds.length) {
      return NextResponse.json({
        success: true,
        sent: 0,
      });
    }

    const [senderResult, subscriptionsResult] =
      await Promise.all([
        admin
          .from("profiles")
          .select("display_name, username")
          .eq("id", message.sender_id)
          .maybeSingle(),

        admin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth_key")
          .in("user_id", recipientIds),
      ]);

    if (senderResult.error) throw senderResult.error;
    if (subscriptionsResult.error) {
      throw subscriptionsResult.error;
    }

    const sender = senderResult.data;

    const senderName =
      sender?.display_name ||
      sender?.username ||
      "Someone";

    const subscriptions =
      subscriptionsResult.data || [];

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await sendWebPush(subscription, {
            title: `${senderName} sent you a message`,
            body: "You have a new message",
            url: `/messages/${message.conversation_id}`,
            tag: `chat:${message.conversation_id}`,
          });

          return true;
        } catch (error) {
          if ([404, 410].includes(error.statusCode)) {
            await admin
              .from("push_subscriptions")
              .delete()
              .eq("id", subscription.id);

            return false;
          }

          throw error;
        }
      })
    );

    const sent = results.filter(
      (result) =>
        result.status === "fulfilled" &&
        result.value === true
    ).length;

    const failed = results.filter(
      (result) => result.status === "rejected"
    ).length;

    return NextResponse.json({
      success: failed === 0,
      sent,
      failed,
    }, { status: failed ? 503 : 200 });
  } catch (error) {
    console.error("Push delivery failed:", error);

    return NextResponse.json(
      { error: "Push delivery failed" },
      { status: 500 }
    );
  }
}
