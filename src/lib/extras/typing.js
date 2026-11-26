// src/lib/extras/typing.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createTypingChannel({
  conversationId,
  userId,
  onTyping,
  onStatus,
}) {
  if (!conversationId || !userId) {
    throw new Error(
      "Conversation ID and user ID are required."
    );
  }

  await supabase.realtime.setAuth();

  let closed = false;
  let connected = false;

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

  // Receive typing events.
  channel
    .on(
      "broadcast",
      { event: "typing" },
      ({ payload }) => {
        if (
          closed ||
          !payload ||
          typeof payload.userId !== "string" ||
          !UUID_PATTERN.test(payload.userId) ||
          typeof payload.typing !== "boolean" ||
          payload.userId === userId
        ) {
          return;
        }

        onTyping?.({
          userId: payload.userId,
          typing: payload.typing,
        });
      }
    )
    .subscribe((status, error) => {
      if (closed) return;

      connected = status === "SUBSCRIBED";

      onStatus?.(connected);

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        console.warn(
          "Typing channel:",
          status,
          error
        );
      }
    });

  // Broadcast local typing activity.
  function broadcast(typing) {
    if (
      closed ||
      !connected ||
      typeof typing !== "boolean"
    ) {
      return;
    }

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
        if (status !== "ok" && !closed) {
          console.warn(
            "Typing broadcast status:",
            status
          );
        }
      })
      .catch((error) => {
        console.warn(
          "Typing broadcast failed:",
          error
        );
      });
  }

  // Remove the subscription.
  function close() {
    if (closed) return;

    broadcast(false);

    closed = true;
    connected = false;

    void supabase.removeChannel(channel);
  }

  return {
    broadcast,
    close,
  };
}
