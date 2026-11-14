// src/components/NotificationManager.jsx

"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getMessageProfiles } from "@/lib/messageProfiles";

const supabase = createClient();

export default function NotificationManager({ userId }) {
  const router = useRouter();

  const [permission, setPermission] = useState("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Ask for notification permission from a button click.
  async function enableNotifications() {
    if (!("Notification" in window)) return;

    const result = await Notification.requestPermission();
    setPermission(result);
  }

  useEffect(() => {
    if (!userId || permission !== "granted") return;

    let active = true;
    const notifiedIds = new Set();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async ({ new: message }) => {
          if (!active) return;
          if (message.sender_id === userId) return;
          if (document.visibilityState === "visible") return;
          if (notifiedIds.has(message.id)) return;

          notifiedIds.add(message.id);

          try {
            const profiles = await getMessageProfiles([
              message.sender_id,
            ]);

            if (!active) return;
            if (document.visibilityState === "visible") return;

            const sender = profiles[message.sender_id];

            const senderName =
              sender?.display_name ||
              sender?.username ||
              "Someone";

            const notification = new Notification(
              `${senderName} sent you a message`,
              {
                body: message.content,
                icon: "/favicon.ico",
                tag: `message:${message.conversation_id}`,
              }
            );

            notification.onclick = () => {
              window.focus();

              router.push(
                `/messages/${message.conversation_id}`
              );

              notification.close();
            };
          } catch (error) {
            console.error("Notification failed:", error);
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId, permission, router]);

  if (!("Notification" in (typeof window === "undefined" ? {} : window))) {
    return null;
  }

  if (permission === "granted") {
    return (
      <span
        title="Browser notifications enabled"
        className="flex items-center gap-2 text-xs text-green-400"
      >
        <Bell size={16} />
        <span className="hidden lg:inline">
          Notifications on
        </span>
      </span>
    );
  }

  if (permission === "denied") {
    return (
      <span
        title="Enable notifications in your browser's site settings"
        className="flex items-center gap-2 text-xs text-gray-500"
      >
        <BellOff size={16} />
        <span className="hidden lg:inline">
          Notifications blocked
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={enableNotifications}
      className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:bg-gray-800"
    >
      <Bell size={16} />
      <span className="hidden lg:inline">
        Enable notifications
      </span>
    </button>
  );
}
