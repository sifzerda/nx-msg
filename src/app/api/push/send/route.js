// src/app/api/push/send/route.js

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWebPush } from "@/lib/webPush";
import { getNotificationPreview } from "@/utils/notificationPreview";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MESSAGE_COLUMNS = [
  "id",
  "conversation_id",
  "sender_id",
  "content",
  "gif_id",
  "attachment_type",
  "attachment_name",
].join(", ");

function validSecret(request) {
  const authorization = request.headers.get("authorization") || "";

  if (!/^Bearer\s+/i.test(authorization)) {
    return false;
  }

  const provided = authorization.replace(
    /^Bearer\s+/i,
    ""
  );

  const expected = process.env.PUSH_WEBHOOK_SECRET || "";

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return (
    b.length > 0 &&
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

function isValidEvent(payload) {
  return (
    payload?.type === "INSERT" && payload?.table === "messages" && payload?.schema === "public"
  );
}

async function removeExpiredSubscription(admin, subscriptionId) {
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("id", subscriptionId);

  if (error) {
    console.error("Failed to remove expired push subscription:", error.message);
  }
}

async function deliverNotification(admin, subscription, notification) {
  try {
    await sendWebPush(subscription, notification);

    return "sent";
  } catch (error) {
    if ([404, 410].includes(error?.statusCode)) {
      await removeExpiredSubscription(admin, subscription.id);

      return "expired";
    }

    throw error;
  }
}

export async function POST(request) {
  // Authenticate database webhook.

  if (!validSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse webhook payload.

    const payload = await request
      .json()
      .catch(() => null);

    if (!isValidEvent(payload)) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    const messageId = payload.record?.id;

    if (
      typeof messageId !== "string" || !UUID_PATTERN.test(messageId)
    ) {
      return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Retrieve the actual message from the database.
    // Do not trust message content from the webhook.

    const {
      data: message,
      error: messageError,
    } = await admin
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("id", messageId)
      .maybeSingle();

    if (messageError) {
      throw messageError;
    }

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Retrieve conversation recipients,
    // excluding the message sender.

    const {
      data: members,
      error: membersError,
    } = await admin
      .from("conversation_members")
      .select("user_id")
      .eq(
        "conversation_id",
        message.conversation_id
      )
      .neq("user_id", message.sender_id);

    if (membersError) {
      throw membersError;
    }

    const recipientIds = (members ?? []).map((member) => member.user_id);

    if (!recipientIds.length) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        expired: 0,
      });
    }

    // Retrieve sender and recipient subscriptions
    // concurrently.

    const [
      senderResult,
      subscriptionsResult,
    ] = await Promise.all([
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

    if (senderResult.error) {
      throw senderResult.error;
    }

    if (subscriptionsResult.error) {
      throw subscriptionsResult.error;
    }

    const subscriptions = subscriptionsResult.data ?? [];

    if (!subscriptions.length) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        expired: 0,
      });
    }

    const sender = senderResult.data;
    const senderName = sender?.display_name?.trim() || sender?.username?.trim() || "Someone";

    // Construct the notification once,
    // rather than for every subscription.

    const notification = {
      title: `${senderName} sent you a message`,
      body: getNotificationPreview(message),
      url: `/messages/${message.conversation_id}`,
      tag: `chat:${message.conversation_id}`,
    };

    // Deliver notifications concurrently.

    const results = await Promise.allSettled(subscriptions.map((subscription) => deliverNotification(admin, subscription, notification)));

    let sent = 0;
    let failed = 0;
    let expired = 0;

    for (const result of results) {
      if (result.status === "rejected") {
        failed++;
      } else if (result.value === "sent") {
        sent++;
      } else if (result.value === "expired") {
        expired++;
      }
    }

    return NextResponse.json(
      { success: failed === 0, sent, failed, expired },
      { status: failed ? 503 : 200 }
    );
  } catch (error) {
    console.error("Push delivery failed:", error);

    return NextResponse.json({ error: "Push delivery failed" }, { status: 500 });
  }
}