// src/lib/pushClient.js

import { createClient } from "@/lib/supabase/client";

const SERVICE_WORKER_URL = "/sw.js";

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const DISABLED_STATE = Object.freeze({
  preference: false,
  enabled: false,
});

const ENABLED_STATE = Object.freeze({
  preference: true,
  enabled: true,
});

let registrationRequest = null;

/* -------------------- SUPPORT -------------------- */

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/* -------------------- VAPID -------------------- */

function getApplicationServerKey() {
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("Missing VAPID public key");
  }

  const padding = "=".repeat(
    (4 - (VAPID_PUBLIC_KEY.length % 4)) % 4
  );

  const base64 = (VAPID_PUBLIC_KEY + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  return Uint8Array.from(
    atob(base64),
    (char) => char.charCodeAt(0)
  );
}

function matchesApplicationServerKey(
  subscription,
  expectedKey
) {
  const existingKey =
    subscription.options?.applicationServerKey;

  // Some browsers do not expose the existing key.

  if (!existingKey) return true;

  const actualKey = new Uint8Array(existingKey);

  return (
    actualKey.length === expectedKey.length &&
    actualKey.every(
      (byte, index) => byte === expectedKey[index]
    )
  );
}

/* -------------------- API -------------------- */

async function postJSON(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });

  const result = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.error ||
      `Request failed (${response.status})`
    );
  }

  return result;
}

/* -------------------- PREFERENCE -------------------- */

export async function getPushPreference(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const { data, error } = await createClient()
    .from("profiles")
    .select("notifications_enabled")
    .eq("id", userId)
    .single();

  if (error) throw error;

  return data?.notifications_enabled === true;
}

export async function disablePushPreference(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  await postJSON("/api/push/unsubscribe", {
    endpoint: null,
    rememberPreference: true,
  });
}

/* -------------------- SERVICE WORKER -------------------- */

function getRegistration() {
  if (registrationRequest) {
    return registrationRequest;
  }

  registrationRequest = (async () => {
    const serviceWorker = navigator.serviceWorker;

    const existing =
      await serviceWorker.getRegistration("/");

    const worker =
      existing?.active ||
      existing?.waiting ||
      existing?.installing;

    const expectedUrl = new URL(
      SERVICE_WORKER_URL,
      window.location.origin
    ).href;

    if (!existing || worker?.scriptURL !== expectedUrl) {
      await serviceWorker.register(SERVICE_WORKER_URL);
    }

    return serviceWorker.ready;
  })().finally(() => {
    registrationRequest = null;
  });

  return registrationRequest;
}

async function getExistingSubscription() {
  const registration =
    await navigator.serviceWorker.getRegistration("/");

  return registration
    ? registration.pushManager.getSubscription()
    : null;
}

/* -------------------- SUBSCRIPTION -------------------- */

async function getOrCreateSubscription() {
  const applicationServerKey =
    getApplicationServerKey();

  const registration = await getRegistration();

  const { pushManager } = registration;

  const existing =
    await pushManager.getSubscription();

  if (existing) {
    if (
      !matchesApplicationServerKey(
        existing,
        applicationServerKey
      )
    ) {
      throw new Error(
        "The existing push subscription uses a different VAPID key. Disable notifications and enable them again."
      );
    }

    return existing;
  }

  return pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
}

async function registerSubscription(
  subscription,
  rememberPreference
) {
  await postJSON("/api/push/subscribe", {
    subscription: subscription.toJSON(),
    rememberPreference,
  });

  return ENABLED_STATE;
}

/* -------------------- RESTORE -------------------- */

export async function restorePushNotifications(userId) {
  if (!isPushSupported()) {
    return DISABLED_STATE;
  }

  const preference =
    await getPushPreference(userId);

  if (!preference) {
    return DISABLED_STATE;
  }

  if (Notification.permission !== "granted") {
    return {
      preference: true,
      enabled: false,
    };
  }

  const subscription =
    await getOrCreateSubscription();

  return registerSubscription(subscription, false);
}

/* -------------------- ENABLE -------------------- */

export async function enablePushNotifications() {
  if (!isPushSupported()) {
    throw new Error(
      "Push notifications are not supported"
    );
  }

  if (Notification.permission === "denied") {
    throw new Error(
      "Notifications are blocked by your browser"
    );
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error(
      "Notification permission was not granted"
    );
  }

  const subscription =
    await getOrCreateSubscription();

  return registerSubscription(subscription, true);
}

/* -------------------- DISABLE -------------------- */

/* -------------------- SUBSCRIPTION REMOVAL -------------------- */

async function removeSubscription(
  subscription,
  {
    rememberPreference,
    removeOnServerFailure = false,
  }
) {
  let error = null;

  try {
    await postJSON("/api/push/unsubscribe", {
      endpoint: subscription.endpoint,
      rememberPreference,
    });
  } catch (cause) {
    if (!removeOnServerFailure) {
      throw cause;
    }

    error = cause;
  }

  let warning = null;

  try {
    const removed =
      await subscription.unsubscribe();

    if (!removed) {
      warning =
        "Browser subscription could not be removed.";
    }
  } catch {
    warning =
      "Browser subscription cleanup failed.";
  }

  return {
    error,
    warning,
  };
}

/* -------------------- DISABLE -------------------- */

export async function disablePushNotifications(userId) {
  const subscription =
    await getExistingSubscription();

  if (!subscription) {
    await disablePushPreference(userId);

    return DISABLED_STATE;
  }

  const { warning } = await removeSubscription(
    subscription,
    {
      rememberPreference: true,
    }
  );

  return {
    ...DISABLED_STATE,
    warning,
  };
}

/* -------------------- DISMISS NOTIFICATIONS -------------------- */

async function dismissNotifications() {
  const registration =
    await navigator.serviceWorker.getRegistration("/");

  if (!registration) return;

  const notifications =
    await registration.getNotifications();

  for (const notification of notifications) {
    if (
      notification.tag === "messenger" ||
      notification.tag.startsWith("chat:")
    ) {
      notification.close();
    }
  }
}

/* -------------------- LOGOUT CLEANUP -------------------- */

export async function cleanupPushForLogout() {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return null;
  }

  let cleanupError = null;

  try {
    const subscription =
      await getExistingSubscription();

    if (subscription) {
      const { error, warning } =
        await removeSubscription(subscription, {
          rememberPreference: false,
          removeOnServerFailure: true,
        });

      cleanupError =
        error ||
        (warning ? new Error(warning) : null);
    }
  } catch (error) {
    cleanupError = error;
  }

  try {
    await dismissNotifications();
  } catch (error) {
    cleanupError ??= error;
  }

  return cleanupError;
}