// src/lib/chatExport.js

import { createClient } from "@/lib/supabase/client";

const PAGE_SIZE = 500;

function formatDate(value) {
  return new Date(value).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function safeFilename(value) {
  return String(value || "conversation")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .slice(0, 80);
}

export async function exportChatLog(conversation) {
  if (!conversation?.id) {
    throw new Error("No conversation selected");
  }

  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("You must be logged in");
  }

  // Verify membership before exporting.
  const { data: membership, error: membershipError } =
    await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversation.id)
      .eq("user_id", user.id)
      .maybeSingle();

  if (membershipError) throw membershipError;

  if (!membership) {
    throw new Error("You are not a member of this conversation");
  }

  // Retrieve all messages, not just the latest 100.
  const messages = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    messages.push(...(data ?? []));

    if (!data || data.length < PAGE_SIZE) break;

    offset += data.length;
  }

  // Load sender profiles.
  const senderIds = [
    ...new Set(messages.map((m) => m.sender_id).filter(Boolean)),
  ];

  const profileMap = new Map();

  for (let i = 0; i < senderIds.length; i += PAGE_SIZE) {
    const ids = senderIds.slice(i, i + PAGE_SIZE);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", ids);

    if (error) throw error;

    for (const profile of data ?? []) {
      profileMap.set(
        profile.id,
        profile.display_name ||
          profile.username ||
          profile.id
      );
    }
  }

  const chatName =
    conversation.name ||
    conversation.display_name ||
    conversation.username ||
    "Conversation";

  const lines = [
    `Chat: ${chatName}`,
    `Exported: ${formatDate(new Date())}`,
    `Total messages: ${messages.length}`,
    "",
    "----------------------------------------",
    "",
  ];

  for (const message of messages) {
    const sender =
      profileMap.get(message.sender_id) ||
      message.sender_id ||
      "Unknown user";

    lines.push(
      `[${formatDate(message.created_at)}] ${sender}:`,
      message.content ?? "",
      ""
    );
  }

  const blob = new Blob(["\uFEFF", lines.join("\r\n")], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    `${safeFilename(chatName)}-${new Date().toISOString().slice(0, 10)}.txt`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  // Release the temporary browser URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return messages.length;
}
