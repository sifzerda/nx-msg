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
  const { data, error } = await supabase.rpc(
    "get_chat_summaries"
  );

  if (error) throw error;

  return data ?? [];
}

export async function markChatRead(conversationId) {
  const { error } = await supabase.rpc(
    "mark_chat_read",
    { chat_id: conversationId }
  );

  if (error) throw error;
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
