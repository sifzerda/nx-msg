// src/utils/notificationPreview.js

const MAX_PREVIEW_LENGTH = 150;

function truncatePreview(value) {
  const characters = Array.from(value);

  if (characters.length <= MAX_PREVIEW_LENGTH) {
    return value;
  }

  return (
    characters
      .slice(0, MAX_PREVIEW_LENGTH - 1)
      .join("") + "…"
  );
}

export function getNotificationPreview(message) {
  if (!message) {
    return "Sent you a message";
  }

  const content = message.content?.trim() || "";
  const attachmentName =
    message.attachment_name?.trim();

  let preview;

  if (message.gif_id) {
    preview = content
      ? `GIF: ${content}`
      : "Sent you a GIF";
  } else if (message.attachment_type === "image") {
    preview = content
      ? `Photo: ${content}`
      : "Sent you a photo";
  } else if (message.attachment_type === "file") {
    preview = content
      ? `File: ${content}`
      : attachmentName
        ? `Sent you a file: ${attachmentName}`
        : "Sent you a file";
  } else {
    preview = content || "Sent you a message";
  }

  return truncatePreview(preview);
}