// src/utils/messagePreview.js

export function getMessagePreview(message) {
  if (!message) {
    return "Message unavailable";
  }

  const content = message.content?.trim();

  if (message.gif_id) {
    return content ? `GIF: ${content}` : "GIF";
  }

  if (message.attachment_type === "image") {
    return content ? `Photo: ${content}` : "Photo";
  }

  if (message.attachment_type === "file") {
    return content
      || message.attachment_name
      || "Attachment";
  }

  return content || "Message";
}