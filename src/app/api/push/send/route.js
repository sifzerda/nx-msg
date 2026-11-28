// src/app/api/push/send/route.js

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendWebPush } from "@/lib/webPush";
import { getNotificationPreview } from "@/utils/messageUtils";

export const runtime = "nodejs";

/* -------------------- CONSTANTS -------------------- */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MESSAGE_COLUMNS = [
  "id",
  "conversation_id",
  "sender_id",
  "content",
  "gif_id",
  "attachment_type",
  "attachment_name",
].join(", ");

const EXPIRED_STATUS_CODES = new Set([
  404,
  410,
]);

const DELIVERY_BATCH_SIZE = 10;

/* -------------------- RESPONSE -------------------- */

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function emptyDeliveryResult() {
  return json({
    success: true,
    sent: 0,
    failed: 0,
    expired: 0,
  });
}

/* -------------------- AUTHENTICATION -------------------- */

function validSecret(request) {
  const authorization =
    request.headers.get("authorization") || "";

  if (!/^Bearer\s+/i.test(authorization)) {
    return false;
  }

  const provided = authorization.replace(
    /^Bearer\s+/i,
    ""
  );

  const expected =
    process.env.PUSH_WEBHOOK_SECRET || "";

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return (
    b.length > 0 &&
    a.length === b.length &&
    timingSafeEqual(a, b)
  );
}

/* -------------------- VALIDATION -------------------- */

function isValidEvent(payload) {
  return (
    payload?.type === "INSERT" &&
    payload?.table === "messages" &&
    payload?.schema === "public"
  );
}

function isValidMessageId(messageId) {
  return (
    typeof messageId === "string" &&
    UUID_PATTERN.test(messageId)
  );
}

/* -------------------- DATABASE -------------------- */

async function getMessage(admin, messageId) {
  const { data, error } = await admin
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("id", messageId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getEligibleSubscriptions(
  admin,
  messageId
) {
  const { data, error } = await admin.rpc(
    "get_message_push_subscriptions",
    {
      target_message_id: messageId,
    }
  );

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "Invalid push subscription response"
    );
  }

  return data;
}

async function getSender(admin, senderId) {
  const { data, error } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", senderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/* -------------------- NOTIFICATION -------------------- */

function createNotification(message, sender) {
  const senderName =
    sender?.display_name?.trim() ||
    sender?.username?.trim() ||
    "Someone";

  return {
    title: `${senderName} sent you a message`,

    body: getNotificationPreview(message),

    url: `/messages/${message.conversation_id}`,

    tag: `chat:${message.conversation_id}`,
  };
}

/* -------------------- DELIVERY -------------------- */

async function deliverNotification(
  subscription,
  notification
) {
  try {
    await sendWebPush(
      subscription,
      notification
    );

    return {
      status: "sent",
    };

  } catch (error) {
    if (
      EXPIRED_STATUS_CODES.has(
        error?.statusCode
      )
    ) {
      return {
        status: "expired",
        subscriptionId: subscription.id,
      };
    }

    throw error;
  }
}

/* -------------------- EXPIRED SUBSCRIPTIONS -------------------- */

async function removeExpiredSubscriptions(
  admin,
  subscriptionIds
) {
  if (!subscriptionIds.length) {
    return;
  }

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .in("id", subscriptionIds);

  if (error) {
    console.error(
      "Failed to remove expired push subscriptions:",
      error.message
    );
  }
}

/* -------------------- BATCHED DELIVERY -------------------- */

async function deliverNotifications(
  admin,
  subscriptions,
  notification
) {
  let sent = 0;
  let failed = 0;
  let expired = 0;

  const expiredSubscriptionIds = [];

  for (
    let offset = 0;
    offset < subscriptions.length;
    offset += DELIVERY_BATCH_SIZE
  ) {
    const batch = subscriptions.slice(
      offset,
      offset + DELIVERY_BATCH_SIZE
    );

    const results = await Promise.allSettled(
      batch.map((subscription) =>
        deliverNotification(
          subscription,
          notification
        )
      )
    );

    for (const result of results) {
      if (result.status === "rejected") {
        failed++;

        continue;
      }

      const delivery = result.value;

      if (delivery.status === "sent") {
        sent++;

      } else if (delivery.status === "expired") {
        expired++;

        expiredSubscriptionIds.push(
          delivery.subscriptionId
        );
      }
    }
  }

  /* Delete expired subscriptions in one request. */

  await removeExpiredSubscriptions(
    admin,
    expiredSubscriptionIds
  );

  return {
    sent,
    failed,
    expired,
  };
}

/* -------------------- ROUTE -------------------- */

export async function POST(request) {
  /* Authenticate database webhook. */

  if (!validSecret(request)) {
    return json(
      { error: "Unauthorized" },
      401
    );
  }

  try {
    /* Parse and validate webhook event. */

    const payload = await request
      .json()
      .catch(() => null);

    if (!isValidEvent(payload)) {
      return json(
        { error: "Invalid event" },
        400
      );
    }

    const messageId = payload.record?.id;

    if (!isValidMessageId(messageId)) {
      return json(
        { error: "Invalid message ID" },
        400
      );
    }

    const admin = createAdminClient();

    /* Retrieve authoritative message data. */

    const message = await getMessage(
      admin,
      messageId
    );

    if (!message) {
      return json(
        { error: "Message not found" },
        404
      );
    }

    /* Retrieve eligible subscriptions.

       The database function enforces:

       - Conversation membership
       - Sender exclusion
       - Notification preferences
       - Bidirectional private-chat blocking
       - Group notification support
    */

    const subscriptions =
      await getEligibleSubscriptions(
        admin,
        message.id
      );

    if (!subscriptions.length) {
      return emptyDeliveryResult();
    }

    /* Only retrieve sender information if
       there are notifications to deliver. */

    const sender = await getSender(
      admin,
      message.sender_id
    );

    const notification = createNotification(
      message,
      sender
    );

    /* Deliver notifications in bounded batches. */

    const {
      sent,
      failed,
      expired,
    } = await deliverNotifications(
      admin,
      subscriptions,
      notification
    );

    return json(
      {
        success: failed === 0,
        sent,
        failed,
        expired,
      },
      failed ? 503 : 200
    );

  } catch (error) {
    console.error(
      "Push delivery failed:",
      error
    );

    return json(
      { error: "Push delivery failed" },
      500
    );
  }
}