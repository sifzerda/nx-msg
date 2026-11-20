// src/components/PushNotificationButton.jsx

"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);

  const base64 = (value + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = atob(base64);

  return Uint8Array.from(
    raw,
    (char) => char.charCodeAt(0)
  );
}

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : "Something went wrong";
}

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
      result.error || `Request failed (${response.status})`
    );
  }

  return result;
}

async function getPreference() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("notifications_enabled")
    .eq("id", user.id)
    .single();

  if (error) throw error;

  return data.notifications_enabled === true;
}

async function getRegistration() {
  return navigator.serviceWorker.register("/sw.js");
}

async function getSubscription(registration) {
  return registration.pushManager.getSubscription();
}

async function createSubscription(registration) {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error("Missing VAPID public key");
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey:
      urlBase64ToUint8Array(publicKey),
  });
}

async function registerSubscription(
  subscription,
  rememberPreference
) {
  return postJSON("/api/push/subscribe", {
    subscription: subscription.toJSON(),
    rememberPreference,
  });
}

export default function PushNotificationButton() {
  const [supported, setSupported] = useState(false);
  const [checking, setChecking] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mountedRef = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const isSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(isSupported);

    if (!isSupported) {
      setChecking(false);
      return () => {
        mountedRef.current = false;
      };
    }

    async function restoreNotifications() {
      try {
        const preference = await getPreference();

        if (!mountedRef.current) return;

        if (!preference) {
          setEnabled(false);
          return;
        }

        // Do not request permission automatically.
        if (Notification.permission !== "granted") {
          setEnabled(false);
          return;
        }

        const registration = await getRegistration();

        if (!mountedRef.current) return;

        let subscription =
          await getSubscription(registration);

        // After logout, the browser subscription was
        // removed. Recreate it silently on login.
        if (!subscription) {
          subscription =
            await createSubscription(registration);
        }

        if (!mountedRef.current) return;

        await registerSubscription(subscription, false);

        if (mountedRef.current) {
          setEnabled(true);
        }
      } catch (err) {
        console.error(
          "Failed to restore notifications:",
          err
        );

        if (mountedRef.current) {
          setEnabled(false);
          setError(getErrorMessage(err));
        }
      } finally {
        if (mountedRef.current) {
          setChecking(false);
        }
      }
    }

    restoreNotifications();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function enable() {
    if (busyRef.current || checking) return;

    busyRef.current = true;
    setLoading(true);
    setError("");

    try {
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error(
          "Notification permission was not granted"
        );
      }

      const registration = await getRegistration();

      let subscription =
        await getSubscription(registration);

      if (!subscription) {
        subscription =
          await createSubscription(registration);
      }

      // Explicit opt-in: save the preference.
      await registerSubscription(subscription, true);

      if (mountedRef.current) {
        setEnabled(true);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(getErrorMessage(err));
      }
    } finally {
      busyRef.current = false;

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  async function disable() {
    if (busyRef.current || checking) return;

    busyRef.current = true;
    setLoading(true);
    setError("");

    try {
      const registration = await getRegistration();

      const subscription =
        await getSubscription(registration);

      if (subscription) {
        await postJSON("/api/push/unsubscribe", {
          endpoint: subscription.endpoint,
          rememberPreference: true,
        });

        const removed =
          await subscription.unsubscribe();

        if (!removed) {
          throw new Error(
            "Could not remove browser subscription"
          );
        }
      } else {
        // No browser subscription exists, but the
        // account preference must still be disabled.
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("Not signed in");
        }

        const { error: preferenceError } = await supabase
          .from("profiles")
          .update({ notifications_enabled: false })
          .eq("id", user.id);

        if (preferenceError) {
          throw preferenceError;
        }
      }

      if (mountedRef.current) {
        setEnabled(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(getErrorMessage(err));
      }
    } finally {
      busyRef.current = false;

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={checking || loading}
        onClick={enabled ? disable : enable}
        className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enabled ? (
          <Bell size={16} />
        ) : (
          <BellOff size={16} />
        )}

        {checking
          ? "Checking..."
          : loading
            ? "Please wait..."
            : enabled
              ? "Disable notifications"
              : "Enable notifications"}
      </button>

      {error && (
        <p
          role="alert"
          className="max-w-64 text-xs text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}
