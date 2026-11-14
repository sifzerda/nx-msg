// src/lib/messages.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Private chats
export async function startChat(contactId) {
  const { data, error } = await supabase.rpc(
    "start_private_chat",
    { other_user_id: contactId }
  );

  if (error) throw error;

  return data;
}

// Group chats
export async function createGroupChat(name, memberIds) {
  const groupName = name.trim();
  const members = [...new Set(memberIds)];

  if (!groupName || groupName.length > 100) {
    throw new Error("Group name must contain 1–100 characters");
  }

  if (members.length < 2 || members.length > 49) {
    throw new Error("Select between 2 and 49 contacts");
  }

  const { data, error } = await supabase.rpc(
    "create_group_chat",
    {
      group_name: groupName,
      member_ids: members,
    }
  );

  if (error) throw error;

  return data;
}

// Conversation list: private + group
export async function getConversations() {
  const [privateResult, groupResult] = await Promise.all([
    supabase.rpc("get_chat_summaries"),
    supabase.rpc("get_group_summaries"),
  ]);

  if (privateResult.error) throw privateResult.error;
  if (groupResult.error) throw groupResult.error;

  const conversations = [
    ...(privateResult.data ?? []).filter(
      (chat) => chat.type === "private"
    ),
    ...(groupResult.data ?? []).filter(
      (chat) => chat.type === "group"
    ),
  ];

  // Prevent duplicate conversations.
  const unique = [
    ...new Map(
      conversations.map((chat) => [chat.id, chat])
    ).values(),
  ];

  // Most recently active conversation first.
  return unique.sort((a, b) => {
    const aTime = a.last_message_at ?? a.created_at;
    const bTime = b.last_message_at ?? b.created_at;

    return new Date(bTime) - new Date(aTime);
  });
}

// Group summaries
export async function getGroupSummaries() {
  const { data, error } = await supabase.rpc(
    "get_group_summaries"
  );

  if (error) throw error;

  return data ?? [];
}

// Messages
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
    .select(
      "id, conversation_id, sender_id, content, created_at"
    )
    .single();

  if (error) throw error;

  return data;
}

// Mark conversation as read
export async function markChatRead(conversationId) {
  const { error } = await supabase.rpc(
    "mark_chat_read",
    { chat_id: conversationId }
  );

  if (error) throw error;
}

// Recipient read status (private chats)
export async function getRecipientReadAt(conversationId) {
  const { data, error } = await supabase.rpc(
    "get_recipient_read_at",
    { chat_id: conversationId }
  );

  if (error) throw error;

  return data;
}

// Realtime messages
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
      (payload) => {
        onMessage(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
