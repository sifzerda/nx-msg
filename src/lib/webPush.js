// src/lib/webPush.js

import "server-only";
import * as webpush from "web-push";

export async function sendWebPush(subscription, payload) {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error("Missing Web Push environment variables");
  }

  webpush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  );

  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth_key,
      },
    },
    JSON.stringify(payload),
    {
      TTL: 3600,
    }
  );
}
