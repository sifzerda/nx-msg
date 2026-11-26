// src/lib/presence.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

/* -------------------- CONSTANTS -------------------- */

const CHANNEL_NAME = "messenger-presence";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -------------------- VALIDATION -------------------- */

function isValidUserId(userId) {
  return (
    typeof userId === "string" && UUID_PATTERN.test(userId)
  );
}

/* -------------------- PRESENCE -------------------- */

export function subscribeToPresence(userId, onChange) {
  if (!isValidUserId(userId)) {
    throw new Error("Invalid presence user ID");
  }

  if (typeof onChange !== "function") {
    throw new Error("Presence callback is required");
  }

  let closed = false;
  let channel = null;

  /* -------------------- SYNCHRONISE -------------------- */

  function updatePresence() {
    if (closed || !channel) return;

    const state = channel.presenceState();
    const onlineUsers = Object.keys(state).filter((id) => isValidUserId(id) && state[id]?.length > 0);

    onChange(onlineUsers);
  }

  /* -------------------- STATUS -------------------- */

  async function handleStatus(status, error) {
    if (closed || !channel) return;

    if (status === "SUBSCRIBED") {
      try {
        const result = await channel.track({
          online: true,
        });

        if (closed) return;

        if (result !== "ok") {
          console.warn("Presence tracking status:", result);
        }

      } catch (trackError) {
        if (!closed) {
          console.error("Presence tracking failed:", trackError);
        }
      }

      return;
    }

    if (
      status === "CHANNEL_ERROR" ||
      status === "TIMED_OUT" ||
      status === "CLOSED"
    ) {
      onChange([]);

      if (status !== "CLOSED") {
        console.warn("Presence channel:", status, error);
      }
    }
  }

  /* -------------------- CONNECT -------------------- */

  async function connect() {
    try {
      // Authenticate the Realtime connection.
      await supabase.realtime.setAuth();

      // The component may have unmounted while
      // authentication was being performed.
      if (closed) return;

      channel = supabase.channel(CHANNEL_NAME, {
        config: {
          private: true,

          presence: {
            key: userId,
          },
        },
      });

      channel
        .on("presence", { event: "sync" }, updatePresence)
        .subscribe(handleStatus);

    } catch (error) {
      if (closed) return;

      onChange([]);

      console.error("Failed to connect presence channel:", error);

      if (channel) {
        const failedChannel = channel;

        channel = null;

        void supabase.removeChannel(failedChannel);
      }
    }
  }

  void connect();

  /* -------------------- CLEANUP -------------------- */

  return function unsubscribe() {
    if (closed) return;

    closed = true;

    if (channel) {
      const currentChannel = channel;

      channel = null;

      void supabase.removeChannel(currentChannel);
    }
  };
}