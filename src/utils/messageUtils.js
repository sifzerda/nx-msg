// src/utils/messageUtils.js

const MAX_NOTIFICATION_LENGTH = 150;

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/* -------------------- DATES -------------------- */

export function getDateKey(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatMessageDate(value, now = new Date()) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  const key = getDateKey(date);

  if (key === getDateKey(now)) {
    return "Today";
  }

  const yesterday = new Date(now);

  yesterday.setDate(yesterday.getDate() - 1);

  return key === getDateKey(yesterday)
    ? "Yesterday"
    : dateFormatter.format(date);
}

export function groupMessagesByDate(messages) {
  const groups = [];

  for (const message of messages) {
    const key = getDateKey(message.created_at);
    const previous = groups.at(-1);

    if (previous?.key === key) {
      previous.messages.push(message);
    } else {
      groups.push({
        key,
        date: message.created_at,
        messages: [message],
      });
    }
  }

  return groups;
}

/* -------------------- TEXT -------------------- */

export function truncateText(value, maxLength = 150) {
  if (maxLength <= 0) return "";

  // Fast path for short strings.
  if (value.length <= maxLength) {
    return value;
  }

  // Avoid splitting Unicode surrogate pairs.
  const characters = Array.from(value);

  return characters.length <= maxLength
    ? value
    : characters.slice(0, maxLength - 1).join("") + "…";
}

/* -------------------- MESSAGE PREVIEWS -------------------- */

function formatPreview(message, notification = false) {
  const fallback = notification
    ? "Sent you a message"
    : "Message";

  if (!message) {
    return notification
      ? fallback
      : "Message unavailable";
  }

  const content = message.content?.trim() || "";

  if (message.gif_id) {
    return content
      ? `GIF: ${content}`
      : notification
        ? "Sent you a GIF"
        : "GIF";
  }

  if (message.attachment_type === "image") {
    return content
      ? `Photo: ${content}`
      : notification
        ? "Sent you a photo"
        : "Photo";
  }

  if (message.attachment_type === "file") {
    if (!notification) {
      return (
        content ||
        message.attachment_name ||
        "Attachment"
      );
    }

    if (content) {
      return `File: ${content}`;
    }

    const name = message.attachment_name?.trim();

    return name
      ? `Sent you a file: ${name}`
      : "Sent you a file";
  }

  return content || fallback;
}

export function getMessagePreview(message) {
  return formatPreview(message);
}

export function getNotificationPreview(message) {
  return truncateText(
    formatPreview(message, true),
    MAX_NOTIFICATION_LENGTH
  );
}