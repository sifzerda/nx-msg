// src/lib/presence.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export function subscribeToPresence(
  userId,
  onChange
) {
  const channel = supabase.channel(
    "messenger-presence",
    {
      config: {
        presence: {
          key: userId,
        },
      },
    }
  );

  function updatePresence() {
    const state = channel.presenceState();

    onChange(
      Object.keys(state).filter(
        (id) => state[id]?.length > 0
      )
    );
  }

  channel
    .on("presence", { event: "sync" }, updatePresence)
    .on("presence", { event: "join" }, updatePresence)
    .on("presence", { event: "leave" }, updatePresence)
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          online_at: new Date().toISOString(),
        });
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

