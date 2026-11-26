// src/lib/messages.js

import { createClient } from "@/lib/supabase/client";
import { isValidGifId } from "@/lib/extras/gifs";

const supabase = createClient();
const MESSAGE_COLUMNS = [
  "id",
  "conversation_id",
  "sender_id",
  "content",
  "created_at",
  "reply_to_id",
  "attachment_path",
  "attachment_type",
  "attachment_name",
  "attachment_size",
  "attachment_mime_type",
  "gif_id",
].join(", ");
const MESSAGE_LIMIT = 100;

export async function startChat(contactId) {
  const { data, error } = await supabase.rpc("start_private_chat", { other_user_id: contactId });

  if (error) throw error;

  return data;
}

export async function createGroupChat(name, memberIds) {
  const groupName = name.trim();

  const members = [
    ...new Set(memberIds.filter(Boolean)),
  ];

  if (!groupName || groupName.length > 100) {
    throw new Error("Group name must contain 1–100 characters");
  }

  if (members.length < 2 || members.length > 49) {
    throw new Error("Select between 2 and 49 contacts");
  }

  const { data, error } = await supabase.rpc("create_group_chat", { group_name: groupName, member_ids: members });

  if (error) throw error;

  return data;
}

export async function getConversations() {
  const { data, error } = await supabase.rpc("get_conversation_summaries");
  if (error) throw error;
  return data ?? [];
}

export async function getGroupSummaries() {
  const { data, error } = await supabase.rpc("get_group_summaries");
  if (error) throw error;
  return data ?? [];
}

export async function getMessages(conversationId) {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MESSAGE_LIMIT);

  if (error) throw error;

  return (data ?? []).reverse();
}

export async function sendMessage(conversationId, content, replyToId = null, attachment = null, gifId = null) {
  const message = content.trim();

  if (message.length > 5000) {
    throw new Error("Message is too long");
  }

  if (!message && !attachment && !gifId) {
    throw new Error("Message cannot be empty");
  }

  if (attachment && gifId) {
    throw new Error("A message cannot contain both a GIF and an attachment");
  }

  if (gifId !== null && !isValidGifId(gifId)) {
    throw new Error("Invalid GIF ID");
  }

  const { data, error } = await supabase
    .rpc("send_chat_message", {
      chat_id: conversationId,
      message_content: message,
      reply_id: replyToId,
      file_path: attachment?.path ?? null,
      file_name: attachment?.name ?? null,
      selected_gif_id: gifId,
    })
    .single();

  if (error) throw error;

  return data;
}

export async function markChatRead(conversationId) {
  const { error } = await supabase.rpc("mark_chat_read", { chat_id: conversationId });

  if (error) throw error;
}

export async function getRecipientReadAt(conversationId) {
  const { data, error } = await supabase.rpc("get_recipient_read_at", { chat_id: conversationId });

  if (error) throw error;

  return data;
}

// Global message subscription.
export function subscribeToAllMessages(userId, onMessage, onStatus) {
  const channel = supabase
    .channel(`messages:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      ({ new: message }) => {
        onMessage(message);
      }
    )
    .subscribe(onStatus);

  return () => {
    void supabase.removeChannel(channel);
  };
}

// Retained for backwards compatibility.
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
      ({ new: message }) => {
        onMessage(message);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToReadReceipts(conversationId, onReceipt, onStatus) {
  const channel = supabase
    .channel(`read-receipts:${conversationId}:${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversation_members",
        filter: `conversation_id=eq.${conversationId}`,
      },
      ({ new: member }) => {
        onReceipt(member);
      }
    )
    .subscribe(onStatus);

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function getMessagesByIds(
  conversationId,
  messageIds
) {
  const ids = [...new Set(messageIds)].filter(Boolean);

  if (!conversationId || !ids.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .in("id", ids);

  if (error) throw error;

  return data ?? [];
}
