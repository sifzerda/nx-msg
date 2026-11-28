// src/lib/chatExport.js

import { createClient } from "@/lib/supabase/client";
import { getMessageProfiles } from "@/lib/messageProfiles";

import {
  formatExportDate,
  safeExportFilename,
  formatExportMessage,
  formatExportReply,
} from "@/utils/chatExportFormat";

const PAGE_SIZE = 500;

const MESSAGE_COLUMNS = [
  "id",
  "sender_id",
  "content",
  "created_at",
  "reply_to_id",
  "gif_id",
  "attachment_path",
  "attachment_type",
  "attachment_name",
  "attachment_size",
  "attachment_mime_type",
].join(", ");

/* -------------------- AUTHORIZATION -------------------- */

async function verifyMembership(supabase, conversationId) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("You must be logged in");
  }

  const { data: membership, error } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!membership) {
    throw new Error(
      "You are not a member of this conversation"
    );
  }

  return user;
}

/* -------------------- MESSAGE RETRIEVAL -------------------- */

async function getExportMessages(
  supabase,
  conversationId,
  exportedAt
) {
  const messages = [];

  let cursor = null;

  while (true) {
    let request = supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("conversation_id", conversationId)
      .lte("created_at", exportedAt)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (cursor) {
      request = request.or(
        `created_at.gt.${cursor.created_at},` +
        `and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`
      );
    }

    const { data, error } = await request;

    if (error) throw error;

    const rows = data ?? [];

    messages.push(...rows);

    if (rows.length < PAGE_SIZE) break;

    cursor = rows.at(-1);
  }

  return messages;
}

/* -------------------- PROFILE RETRIEVAL -------------------- */

async function getExportProfiles(messages) {
  const senderIds = new Set();

  for (const message of messages) {
    if (message.sender_id) {
      senderIds.add(message.sender_id);
    }
  }

  const profiles = await getMessageProfiles(
    [...senderIds]
  );

  const profileMap = new Map();

  for (const id of senderIds) {
    const profile = profiles[id];

    if (!profile) continue;

    profileMap.set(
      id,
      profile.display_name?.trim() ||
        profile.username?.trim() ||
        id
    );
  }

  return profileMap;
}

/* -------------------- EXPORT FORMATTING -------------------- */

function getConversationName(conversation) {
  return (
    conversation.name?.trim() ||
    conversation.display_name?.trim() ||
    conversation.username?.trim() ||
    "Conversation"
  );
}

function buildExportParts({
  conversation,
  chatName,
  exportedAt,
  messages,
  profileMap,
}) {
  const messageMap = new Map();

  for (const message of messages) {
    messageMap.set(message.id, message);
  }

  const type =
    conversation.type === "group"
      ? "Group conversation"
      : "Private conversation";

  const parts = [
    "\uFEFF",
    [
      `Chat: ${chatName}`,
      `Type: ${type}`,
      `Exported: ${formatExportDate(exportedAt)}`,
      `Total messages: ${messages.length}`,
      "",
      "Media attachments are represented by metadata.",
      "Image, file and GIF contents are not embedded.",
      "",
      "----------------------------------------",
      "",
      "",
    ].join("\r\n"),
  ];

  for (const message of messages) {
    const sender =
      profileMap.get(message.sender_id) ||
      message.sender_id ||
      "Unknown user";

    const timestamp = formatExportDate(
      message.created_at
    );

    const reply = formatExportReply(
      message,
      messageMap,
      profileMap
    );

    parts.push(
      `[${timestamp}] ${sender}:\r\n` +
      (reply ? `${reply}\r\n` : "") +
      formatExportMessage(message) +
      "\r\n\r\n"
    );
  }

  return parts;
}

/* -------------------- DOWNLOAD -------------------- */

function downloadExport(parts, filename) {
  const blob = new Blob(parts, {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
}

/* -------------------- PUBLIC INTERFACE -------------------- */

export async function exportChatLog(conversation) {
  if (!conversation?.id) {
    throw new Error("No conversation selected");
  }

  const supabase = createClient();

  const user = await verifyMembership(
    supabase,
    conversation.id
  );

  const exportedAt = new Date().toISOString();

  const messages = await getExportMessages(
    supabase,
    conversation.id,
    exportedAt
  );

  const profileMap = await getExportProfiles(messages);

  // Ensure the account has not changed during export.
  const {
    data: { user: currentUser },
    error,
  } = await supabase.auth.getUser();

  if (error || currentUser?.id !== user.id) {
    throw new Error("Your session changed during export");
  }

  const chatName = getConversationName(conversation);

  const parts = buildExportParts({
    conversation,
    chatName,
    exportedAt,
    messages,
    profileMap,
  });

  const filename =
    `${safeExportFilename(chatName)}-` +
    `${exportedAt.slice(0, 10)}.txt`;

  downloadExport(parts, filename);

  return messages.length;
}