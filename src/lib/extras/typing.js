// src/lib/extras/typing.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(id) {
  return typeof id === "string" && UUID_PATTERN.test(id);
}

export async function createTypingChannel({
  conversationId,
  userId,
  onTyping,
  onStatus,
}) {
  if (!isValidId(conversationId) || !isValidId(userId)) {
    throw new Error("Invalid conversation or user ID");
  }

  await supabase.realtime.setAuth();

  let closed = false;
  let connected = false;
  let advertisedTyping = false;

  const channel = supabase.channel(
    `typing:${conversationId}`,
    {
      config: {
        private: true,
        broadcast: {
          self: false,
          ack: false,
        },
      },
    }
  );

  function handleTyping({ payload }) {
    if (
      closed ||
      !connected ||
      !isValidId(payload?.userId) ||
      payload.userId === userId ||
      typeof payload.typing !== "boolean"
    ) {
      return;
    }

    onTyping?.({
      userId: payload.userId,
      typing: payload.typing,
    });
  }

  function handleStatus(status, error) {
    if (closed) return;

    const nextConnected = status === "SUBSCRIBED";

    if (connected !== nextConnected) {
      connected = nextConnected;

      if (!connected) {
        advertisedTyping = false;
      }

      onStatus?.(connected);
    }

    if (
      status === "CHANNEL_ERROR" ||
      status === "TIMED_OUT"
    ) {
      console.warn("Typing channel:", status, error);
    }
  }

  function broadcast(typing) {
    if (
      closed ||
      !connected ||
      typeof typing !== "boolean"
    ) {
      return false;
    }

    // Repeated true events are intentional heartbeats.
    // Repeated false events are unnecessary.
    if (!typing && !advertisedTyping) {
      return false;
    }

    advertisedTyping = typing;

    void channel
      .send({
        type: "broadcast",
        event: "typing",
        payload: {
          userId,
          typing,
        },
      })
      .then((status) => {
        if (!closed && status !== "ok") {
          console.warn(
            "Typing broadcast status:",
            status
          );
        }
      })
      .catch((error) => {
        if (!closed) {
          console.warn(
            "Typing broadcast failed:",
            error
          );
        }
      });

    return true;
  }

  function close() {
    if (closed) return;

    // Only sends false if typing was advertised.
    broadcast(false);

    closed = true;
    connected = false;

    void supabase.removeChannel(channel);
  }

  try {
    channel
      .on(
        "broadcast",
        { event: "typing" },
        handleTyping
      )
      .subscribe(handleStatus);
  } catch (error) {
    close();
    throw error;
  }

  return {
    broadcast,
    close,

    isConnected() {
      return connected && !closed;
    },
  };
}