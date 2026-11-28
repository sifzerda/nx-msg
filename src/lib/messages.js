// src/lib/messages.js

import { createClient } from "@/lib/supabase/client";
import { isValidGifId } from "@/lib/extras/gifs";
import { MAX_MESSAGE_LENGTH } from "@/constants/messages";
import { isUuid } from "@/utils/validation";

const supabase = createClient();

const MESSAGE_LIMIT = 100;

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
  "mentions",
].join(", ");

/* -------------------- SHARED HELPERS -------------------- */

async function execute(query) {
  const { data, error } = await query;

  if (error) throw error;

  return data;
}

function rpc(name, params) {
  return execute(
    params === undefined
      ? supabase.rpc(name)
      : supabase.rpc(name, params)
  );
}

function messageQuery(conversationId) {
  return supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId);
}

function subscribeToChanges(
  topic,
  config,
  callback,
  onStatus
) {
  const subscription = supabase
    .channel(topic)
    .on(
      "postgres_changes",
      {
        schema: "public",
        ...config,
      },
      ({ new: record }) => callback(record)
    );

  const channel =
    onStatus === undefined
      ? subscription.subscribe()
      : subscription.subscribe(onStatus);

  return () => {
    void supabase.removeChannel(channel);
  };
}

/* -------------------- VALIDATION -------------------- */

export function validateMessage(
  content,
  attachment = null,
  gifId = null
) {
  if (typeof content !== "string") {
    throw new Error("Invalid message content");
  }

  const message = content.trim();

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error("Message is too long");
  }

  if (!message && !attachment && !gifId) {
    throw new Error("Message cannot be empty");
  }

  if (attachment && gifId) {
    throw new Error(
      "A message cannot contain both a GIF and an attachment"
    );
  }

  if (gifId !== null && !isValidGifId(gifId)) {
    throw new Error("Invalid GIF ID");
  }

  return message;
}

/* -------------------- CONVERSATIONS -------------------- */

export function startChat(contactId) {
  return rpc("start_private_chat", {
    other_user_id: contactId,
  });
}

export async function createGroupChat(name, memberIds) {
  const groupName = name.trim();

  const members = [
    ...new Set(memberIds.filter(Boolean)),
  ];

  if (!groupName || groupName.length > 100) {
    throw new Error(
      "Group name must contain 1–100 characters"
    );
  }

  if (members.length < 2 || members.length > 49) {
    throw new Error(
      "Select between 2 and 49 contacts"
    );
  }

  return rpc("create_group_chat", {
    group_name: groupName,
    member_ids: members,
  });
}

export async function getConversations() {
  return (await rpc("get_conversation_summaries")) ?? [];
}

/* -------------------- MESSAGE RETRIEVAL -------------------- */

export async function getMessages(conversationId) {
  const data = await execute(
    messageQuery(conversationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MESSAGE_LIMIT)
  );

  return (data ?? []).reverse();
}

export async function getMessagesByIds(
  conversationId,
  messageIds
) {
  const ids = [...new Set(messageIds)].filter(Boolean);

  if (!conversationId || !ids.length) {
    return [];
  }

  return (
    await execute(
      messageQuery(conversationId).in("id", ids)
    )
  ) ?? [];
}

/* -------------------- SEND MESSAGE -------------------- */

export async function sendMessage(
  conversationId,
  content,
  replyToId = null,
  attachment = null,
  gifId = null
) {
  const message = validateMessage(
    content,
    attachment,
    gifId
  );

  return execute(
    supabase
      .rpc("send_chat_message", {
        chat_id: conversationId,
        message_content: message,
        reply_id: replyToId,
        file_path: attachment?.path ?? null,
        file_name: attachment?.name ?? null,
        selected_gif_id: gifId,
      })
      .single()
  );
}

/* -------------------- READ RECEIPTS -------------------- */

export async function markChatRead(conversationId) {
  await rpc("mark_chat_read", {
    chat_id: conversationId,
  });
}

export function getRecipientReadAt(conversationId) {
  return rpc("get_recipient_read_at", {
    chat_id: conversationId,
  });
}

/* -------------------- REALTIME -------------------- */

export function subscribeToAllMessages(
  userId,
  onMessage,
  onStatus
) {
  return subscribeToChanges(
    `messages:${userId}`,
    {
      event: "INSERT",
      table: "messages",
    },
    onMessage,
    onStatus
  );
}

export function subscribeToReadReceipts(
  conversationId,
  onReceipt,
  onStatus
) {
  return subscribeToChanges(
    `read-receipts:${conversationId}:${crypto.randomUUID()}`,
    {
      event: "UPDATE",
      table: "conversation_members",
      filter: `conversation_id=eq.${conversationId}`,
    },
    onReceipt,
    onStatus
  );
}

/* -------------------- CONVERSATION MEMBERS -------------------- */

export async function getConversationMembers(
  conversationId,
  signal
) {
  if (!isUuid(conversationId)) {
    throw new Error("Invalid conversation ID");
  }

  let query = supabase
    .from("conversation_members")
    .select(`
      user_id,
      joined_at,
      last_read_at,
      profile:profiles!conversation_members_user_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq("conversation_id", conversationId);

  if (signal) {
    query = query.abortSignal(signal);
  }

  return (await execute(query)) ?? [];
}