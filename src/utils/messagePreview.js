// utils/messagePreview.js

export function getMessagePreview(message) {
    if (!message) {
        return "Message unavailable";
    }

    const content = message.content?.trim();

    if (content) {
        return content;
    }

    if (message.attachment_type === "image") {
        return "Photo";
    }

    if (message.attachment_type === "file") {
        return message.attachment_name || "Attachment";
    }

    return "Message";
}