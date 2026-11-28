// src/lib/extras/reactions.js

import { createClient } from "@/lib/supabase/client";
import { QUICK_REACTIONS } from "@/constants/messages";

const supabase = createClient();

const REACTION_COLUMNS = `
  id,
  conversation_id,
  message_id,
  user_id,
  emoji,
  created_at
`;

const PAGE_SIZE = 500;

export async function getReactions(
  conversationId,
  messageIds
) {
  const ids = [...new Set(messageIds)].filter(Boolean);

  if (!conversationId || !ids.length) {
    return [];
  }

  const reactions = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("message_reactions")
      .select(REACTION_COLUMNS)
      .eq("conversation_id", conversationId)
      .in("message_id", ids)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    reactions.push(...(data ?? []));

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return reactions;
}

export async function addReaction({
  conversationId,
  messageId,
  userId,
  emoji,
}) {
  if (!QUICK_REACTIONS.includes(emoji)) {
    throw new Error("Invalid reaction");
  }

  const { data, error } = await supabase
    .from("message_reactions")
    .upsert(
      {
        conversation_id: conversationId,
        message_id: messageId,
        user_id: userId,
        emoji,
      },
      {
        onConflict: "message_id,user_id,emoji",
        ignoreDuplicates: true,
      }
    )
    .select(REACTION_COLUMNS)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function removeReaction({
  conversationId,
  messageId,
  userId,
  emoji,
}) {
  const { error } = await supabase
    .from("message_reactions")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji);

  if (error) throw error;
}

export async function subscribeToReactions({
  conversationId,
  onChange,
  onStatus,
}) {
  await supabase.realtime.setAuth();

  let closed = false;

  const channel = supabase.channel(
    `reactions:${conversationId}`,
    {
      config: {
        private: true,
        broadcast: {
          self: false,
        },
      },
    }
  );

  channel
    .on(
      "broadcast",
      { event: "reaction_change" },
      ({ payload }) => {
        if (closed || !payload?.reaction) return;

        if (
          payload.reaction.conversation_id !==
          conversationId
        ) {
          return;
        }

        onChange(payload);
      }
    )
    .subscribe((status, error) => {
      if (closed) return;

      onStatus?.(status);

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        console.warn(
          "Reaction subscription:",
          status,
          error
        );
      }
    });

  return () => {
    if (closed) return;

    closed = true;

    void supabase.removeChannel(channel);
  };
}
