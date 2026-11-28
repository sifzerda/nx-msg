// src/lib/presence.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const CHANNEL_NAME = "messenger-presence";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUserId(id) {
  return typeof id === "string" && UUID_PATTERN.test(id);
}

export function subscribeToPresence(userId, onChange) {
  if (!isValidUserId(userId)) {
    throw new Error("Invalid presence user ID");
  }

  if (typeof onChange !== "function") {
    throw new Error("Presence callback is required");
  }

  let closed = false;
  let channel = null;
  let connected = false;

  function updatePresence() {
    if (closed || !channel) return;

    const state = channel.presenceState();

    onChange(
      Object.keys(state).filter(
        (id) =>
          isValidUserId(id) &&
          state[id]?.length > 0
      )
    );
  }

  async function handleStatus(status, error) {
    if (closed || !channel) return;

    if (status === "SUBSCRIBED") {
      if (connected) return;

      connected = true;

      try {
        const result = await channel.track({
          online: true,
        });

        if (!closed && result !== "ok") {
          connected = false;

          console.warn(
            "Presence tracking status:",
            result
          );
        }
      } catch (error) {
        if (!closed) {
          connected = false;

          console.error(
            "Presence tracking failed:",
            error
          );
        }
      }

      return;
    }

    if (
      status === "CHANNEL_ERROR" ||
      status === "TIMED_OUT" ||
      status === "CLOSED"
    ) {
      connected = false;

      onChange([]);

      if (status !== "CLOSED") {
        console.warn(
          "Presence channel:",
          status,
          error
        );
      }
    }
  }

  function removeChannel() {
    if (!channel) return;

    const current = channel;

    channel = null;
    connected = false;

    void supabase.removeChannel(current);
  }

  async function connect() {
    try {
      await supabase.realtime.setAuth();

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
        .on(
          "presence",
          { event: "sync" },
          updatePresence
        )
        .subscribe(handleStatus);
    } catch (error) {
      if (closed) return;

      removeChannel();

      onChange([]);

      console.error(
        "Failed to connect presence channel:",
        error
      );
    }
  }

  void connect();

  return () => {
    if (closed) return;

    closed = true;

    removeChannel();
  };
}