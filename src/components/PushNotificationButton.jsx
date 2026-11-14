// src/components/PushNotificationButton.jsx

"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = atob(base64);

  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default function PushNotificationButton() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const isSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(isSupported);

    if (!isSupported) return;

    let active = true;

    async function checkSubscription() {
      const registration =
        await navigator.serviceWorker.register("/sw.js");

      const subscription =
        await registration.pushManager.getSubscription();

      if (active) {
        setEnabled(
          Boolean(subscription) &&
          Notification.permission === "granted"
        );
      }
    }

    checkSubscription().catch(console.error);

    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    setLoading(true);
    setError("");

    try {
      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error("Notification permission denied");
      }

      const registration =
        await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToUint8Array(
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
              ),
          });
      }

      const response = await fetch(
        "/api/push/subscribe",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(subscription.toJSON()),
        }
      );

      if (!response.ok) {
        throw new Error("Could not save subscription");
      }

      setEnabled(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setLoading(true);
    setError("");

    try {
      const registration =
        await navigator.serviceWorker.ready;

      const subscription =
        await registration.pushManager.getSubscription();

      if (subscription) {
        const response = await fetch(
          "/api/push/unsubscribe",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              endpoint: subscription.endpoint,
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Could not disable notifications");
        }

        await subscription.unsubscribe();
      }

      setEnabled(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={enabled ? disable : enable}
        className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {enabled ? (
          <Bell size={16} />
        ) : (
          <BellOff size={16} />
        )}

        {loading
          ? "Please wait..."
          : enabled
            ? "Disable notifications"
            : "Enable notifications"}
      </button>

      {error && (
        <p className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
