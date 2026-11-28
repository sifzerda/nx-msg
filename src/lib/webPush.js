// src/lib/webPush.js

import "server-only";
import * as webpush from "web-push";

const TTL = 3600;
const REQUEST_TIMEOUT = 10_000;

const MAX_ENDPOINT_LENGTH = 4096;

const TRUSTED_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

const TRUSTED_SUFFIXES = [
  ".notify.windows.com",
  ".push.apple.com",
];

let configured = false;

/* -------------------- ENDPOINT VALIDATION -------------------- */

export function isValidPushEndpoint(endpoint) {
  if (
    typeof endpoint !== "string" ||
    !endpoint ||
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    endpoint !== endpoint.trim()
  ) {
    return false;
  }

  try {
    const url = new URL(endpoint);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    ) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    return (
      TRUSTED_HOSTS.has(hostname) ||
      TRUSTED_SUFFIXES.some(
        (suffix) => hostname.endsWith(suffix)
      )
    );
  } catch {
    return false;
  }
}

/* -------------------- CONFIGURATION -------------------- */

function configureWebPush() {
  if (configured) return;

  const subject = process.env.VAPID_SUBJECT;

  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const privateKey =
    process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      "Missing Web Push environment variables"
    );
  }

  webpush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  );

  configured = true;
}

/* -------------------- DELIVERY -------------------- */

export async function sendWebPush(
  subscription,
  payload
) {
  if (!isValidPushEndpoint(subscription?.endpoint)) {
    throw new Error("Unsupported push endpoint");
  }

  configureWebPush();

  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,

      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth_key,
      },
    },

    typeof payload === "string"
      ? payload
      : JSON.stringify(payload),

    {
      TTL,
      timeout: REQUEST_TIMEOUT,
    }
  );
}