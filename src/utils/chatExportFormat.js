// src/utils/chatExportFormat.js

import { formatFileSize } from "@/utils/fileUtils";
import { truncateText } from "@/utils/messageUtils";

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
      .trim()
      .slice(0, 80)
      .replace(/[. ]+$/g, "") ||
    "conversation"
  );
}

export function formatExportMessage(message) {
  const lines = [];

  const content = message.content?.trim() || "";

  if (message.gif_id) {
    lines.push(
      "[GIF]",
      `GIPHY ID: ${message.gif_id}`
    );
  } else if (message.attachment_type === "image") {
    lines.push(
      `[Image: ${message.attachment_name || "Photo"}]`
    );
  } else if (message.attachment_type === "file") {
    lines.push(
      `[File: ${message.attachment_name || "Attachment"}]`
    );
  }

  if (message.attachment_path) {
    if (message.attachment_size != null) {
      lines.push(
        `Size: ${formatFileSize(message.attachment_size)}`
      );
    }

    if (message.attachment_mime_type) {
      lines.push(
        `Type: ${message.attachment_mime_type}`
      );
    }
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

  const original = messageMap.get(message.reply_to_id);

  if (!original) {
    return "> Reply to an unavailable message";
  }

  const sender =
    profileMap.get(original.sender_id) ||
    "Unknown user";

  const preview = formatExportMessage(original)
    .replace(/\s+/g, " ")
    .trim();

  return `> Reply to ${sender}: ${truncateText(preview, 150)}`;
}