// src/app/api/push/send/route.js

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  sendWebPush,
  isValidPushEndpoint,
} from "@/lib/webPush";
import { isUuid } from "@/utils/validation";
import {
  getNotificationPreview,
} from "@/utils/messageUtils";

export const runtime = "nodejs";

/* -------------------- CONSTANTS -------------------- */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/* -------------------- DATABASE -------------------- */

async function getPushDelivery(admin, messageId) {
  const { data, error } = await admin.rpc(
    "get_message_push_delivery",
    {
      target_message_id: messageId,
    }
  );

  if (error) throw error;

  if (data === null) {
    return null;
  }

  if (
    !data?.message ||
    !Array.isArray(data.subscriptions)
  ) {
    throw new Error(
      "Invalid push delivery response"
    );
  }

  return data;
}

/* -------------------- NOTIFICATION -------------------- */

function createNotification(message, sender) {
  const senderName =
    sender?.display_name?.trim() ||
    sender?.username?.trim() ||
    "Someone";

  return JSON.stringify({
    messageId: message.id,

    title: `${senderName} sent you a message`,

    body: getNotificationPreview(message),

    url: `/messages/${message.conversation_id}`,

    tag: `chat:${message.conversation_id}`,
  });
}

/* -------------------- DELIVERY -------------------- */

async function deliverNotification(
  subscription,
  notification
) {
  if (!isValidPushEndpoint(subscription.endpoint)) {
    return "failed";
  }

  try {
    await sendWebPush(
      subscription,
      notification
    );

    return "sent";
  } catch (error) {
    return EXPIRED_STATUS_CODES.has(
      error?.statusCode
    )
      ? "expired"
      : "failed";
  }
}

/* -------------------- CLEANUP -------------------- */

async function removeExpiredSubscriptions(
  admin,
  subscriptionIds
) {
  if (!subscriptionIds.length) return;

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .in("id", subscriptionIds);

  if (error) {
    console.error(
      "[Push] Expired subscription cleanup failed:",
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
  const counts = {
    sent: 0,
    failed: 0,
    expired: 0,
  };

  const expiredIds = [];

  for (
    let offset = 0;
    offset < subscriptions.length;
    offset += DELIVERY_BATCH_SIZE
  ) {
    const batch = subscriptions.slice(
      offset,
      offset + DELIVERY_BATCH_SIZE
    );

    const results = await Promise.all(
      batch.map((subscription) =>
        deliverNotification(
          subscription,
          notification
        )
      )
    );

    for (
      let index = 0;
      index < results.length;
      index++
    ) {
      const status = results[index];

      counts[status]++;

      if (status === "expired") {
        expiredIds.push(batch[index].id);
      }
    }
  }

  await removeExpiredSubscriptions(
    admin,
    expiredIds
  );

  return counts;
}

/* -------------------- ROUTE -------------------- */

export async function POST(request) {
  if (!validSecret(request)) {
    return json(
      { error: "Unauthorized" },
      401
    );
  }

  try {
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

    if (!isUuid(messageId)) {
      return json(
        { error: "Invalid message ID" },
        400
      );
    }

    const admin = createAdminClient();

    const delivery = await getPushDelivery(
      admin,
      messageId
    );

    if (!delivery) {
      return json(
        { error: "Message not found" },
        404
      );
    }

    const {
      message,
      sender,
      subscriptions,
    } = delivery;

    if (!subscriptions.length) {
      return emptyDeliveryResult();
    }

    const notification = createNotification(
      message,
      sender
    );

    const counts = await deliverNotifications(
      admin,
      subscriptions,
      notification
    );

    return json(
      {
        success: counts.failed === 0,
        ...counts,
      },
      counts.failed ? 503 : 200
    );
  } catch (error) {
    console.error(
      "[Push] Delivery failed:",
      {
        message: error?.message,
        code: error?.code,
      }
    );

    return json(
      { error: "Push delivery failed" },
      500
    );
  }
}