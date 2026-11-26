// src/lib/chatExport.js

import { createClient } from "@/lib/supabase/client";

import {
  formatExportDate,
  safeExportFilename,
  formatExportMessage,
  formatExportReply,
} from "@/utils/chatExportFormat";

const PAGE_SIZE = 500;
const PROFILE_BATCH_SIZE = 100;

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

async function verifyMembership(
  supabase,
  conversationId
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("You must be logged in");
  }

  const {
    data: membership,
    error,
  } = await supabase
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
      .order("created_at", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      })
      .limit(PAGE_SIZE);

    // Keyset pagination.
    if (cursor) {
      request = request.or(
        [
          `created_at.gt.${cursor.created_at}`,
          `and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`,
        ].join(",")
      );
    }

    const { data, error } = await request;

    if (error) throw error;

    const rows = data ?? [];

    if (!rows.length) break;

    messages.push(...rows);

    const lastMessage = rows[rows.length - 1];

    cursor = {
      created_at: lastMessage.created_at,
      id: lastMessage.id,
    };

    if (rows.length < PAGE_SIZE) break;
  }

  return messages;
}

async function getExportProfiles(
  supabase,
  messages
) {
  const senderIds = [
    ...new Set(
      messages
        .map((message) => message.sender_id)
        .filter(Boolean)
    ),
  ];

  const profileMap = new Map();

  for (
    let index = 0;
    index < senderIds.length;
    index += PROFILE_BATCH_SIZE
  ) {
    const ids = senderIds.slice(
      index,
      index + PROFILE_BATCH_SIZE
    );

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", ids);

    if (error) throw error;

    for (const profile of data ?? []) {
      profileMap.set(
        profile.id,
        profile.display_name?.trim() ||
          profile.username?.trim() ||
          profile.id
      );
    }
  }

  return profileMap;
}

function getConversationName(conversation) {
  return (
    conversation.name?.trim() ||
    conversation.display_name?.trim() ||
    conversation.username?.trim() ||
    "Conversation"
  );
}

function buildExportHeader({
  chatName,
  conversation,
  exportedAt,
  messageCount,
}) {
  return [
    `Chat: ${chatName}`,
    `Type: ${
      conversation.type === "group"
        ? "Group conversation"
        : "Private conversation"
    }`,
    `Exported: ${formatExportDate(exportedAt)}`,
    `Total messages: ${messageCount}`,
    "",
    "Media attachments are represented by metadata.",
    "Image, file and GIF contents are not embedded.",
    "",
    "----------------------------------------",
    "",
  ].join("\r\n");
}

function buildExportParts({
  conversation,
  chatName,
  exportedAt,
  messages,
  profileMap,
}) {
  const messageMap = new Map(
    messages.map((message) => [
      message.id,
      message,
    ])
  );

  const parts = [
    "\uFEFF",
    buildExportHeader({
      conversation,
      chatName,
      exportedAt,
      messageCount: messages.length,
    }),
    "\r\n",
  ];

  for (const message of messages) {
    const sender =
      profileMap.get(message.sender_id) ||
      message.sender_id ||
      "Unknown user";

    const timestamp = formatExportDate(
      message.created_at
    );

    parts.push(
      `[${timestamp}] ${sender}:\r\n`
    );

    const reply = formatExportReply(
      message,
      messageMap,
      profileMap
    );

    if (reply) {
      parts.push(reply, "\r\n");
    }

    parts.push(
      formatExportMessage(message),
      "\r\n\r\n"
    );
  }

  return parts;
}

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

export async function exportChatLog(conversation) {
  if (!conversation?.id) {
    throw new Error(
      "No conversation selected"
    );
  }

  const supabase = createClient();

  await verifyMembership(
    supabase,
    conversation.id
  );

  // Exclude newly timestamped messages that arrive
  // after the export starts.
  const exportedAt = new Date().toISOString();

  const messages = await getExportMessages(
    supabase,
    conversation.id,
    exportedAt
  );

  const profileMap = await getExportProfiles(
    supabase,
    messages
  );

  const chatName = getConversationName(
    conversation
  );

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