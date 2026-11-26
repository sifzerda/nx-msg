// src/utils/chatExportFormat.js

import { formatFileSize } from "@/utils/fileUtils";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "medium",
});

export function formatExportDate(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : DATE_FORMATTER.format(date);
}

export function safeExportFilename(value) {
  return (
    String(value || "conversation")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/[. ]+$/g, "")
      .trim()
      .slice(0, 80) || "conversation"
  );
}

export function formatExportMessage(message) {
  const lines = [];

  const content = message.content?.trim() || "";

  if (message.gif_id) {
    lines.push("[GIF]");
    lines.push(`GIPHY ID: ${message.gif_id}`);
  } else if (message.attachment_type === "image") {
    lines.push(
      `[Image: ${message.attachment_name || "Photo"}]`
    );
  } else if (message.attachment_type === "file") {
    lines.push(
      `[File: ${message.attachment_name || "Attachment"}]`
    );
  }

  if (
    message.attachment_path &&
    message.attachment_size != null
  ) {
    lines.push(
      `Size: ${formatFileSize(message.attachment_size)}`
    );
  }

  if (
    message.attachment_path &&
    message.attachment_mime_type
  ) {
    lines.push(
      `Type: ${message.attachment_mime_type}`
    );
  }

  if (content) {
    lines.push(content);
  }

  return lines.length
    ? lines.join("\r\n")
    : "[Empty message]";
}

export function formatExportReply(
  message,
  messageMap,
  profileMap
) {
  if (!message.reply_to_id) return null;

  const original = messageMap.get(
    message.reply_to_id
  );

  if (!original) {
    return "> Reply to an unavailable message";
  }

  const sender =
    profileMap.get(original.sender_id) ||
    "Unknown user";

  const preview = formatExportMessage(original)
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const characters = Array.from(preview);

  const shortPreview =
    characters.length > 150
      ? characters.slice(0, 149).join("") + "…"
      : preview;

  return `> Reply to ${sender}: ${shortPreview}`;
}