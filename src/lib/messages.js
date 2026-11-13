// src/lib/messages.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function startChat(contactId) {
  const { data, error } = await supabase.rpc(
    "start_private_chat",
    { other_user_id: contactId }
  );

  if (error) throw error;
  return data;
}

export async function getConversations() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("conversation_members")
    .select(`
      conversation_id,
      conversations!inner (
        id,
        created_at,
        type,
        conversation_members (
          user_id,
          profiles (
            id,
            username,
            display_name,
            avatar_url
          )
        )
      )
    `)
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  if (error) throw error;

  // Deduplicate conversations by ID.
  const unique = new Map();

  for (const row of data ?? []) {
    const chat = row.conversations;

    if (!chat || unique.has(chat.id)) continue;

    unique.set(chat.id, {
      id: chat.id,
      created_at: chat.created_at,
      type: chat.type,
      members: (chat.conversation_members ?? [])
        .map((member) => member.profiles)
        .filter(Boolean),
    });
  }

  return [...unique.values()];
}

export async function getMessages(conversationId) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data ?? []).reverse();
}

export async function sendMessage(conversationId, content) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  const message = content.trim();

  if (!message || message.length > 5000) {
    throw new Error("Message must contain 1–5000 characters");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: message,
    })
    .select("id, conversation_id, sender_id, content, created_at")
    .single();

  if (error) throw error;
  return data;
}

export function subscribeToMessages(conversationId, onMessage) {
  const channel = supabase
    .channel(`chat:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(payload.new)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
