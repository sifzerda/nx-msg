// src/utils/messageUtils.js

import {
  MAX_MESSAGE_LENGTH,
  MAX_NOTIFICATION_LENGTH,
  MAX_MENTION_SUGGESTIONS
} from "@/constants/messages";

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

export function truncateText(
  value,
  maxLength = MAX_NOTIFICATION_LENGTH
) {
  if (
    typeof value !== "string" ||
    !Number.isFinite(maxLength) ||
    maxLength < 1
  ) {
    return "";
  }

  const limit = Math.floor(maxLength);

  if (value.length <= limit) {
    return value;
  }

  let count = 0;
  let offset = 0;
  let truncateAt = 0;

  for (const character of value) {
    if (count === limit) {
      return value.slice(0, truncateAt) + "…";
    }

    offset += character.length;
    count++;

    if (count < limit) {
      truncateAt = offset;
    }
  }

  return value;
}

/* -------------------- COMPOSITION -------------------- */

export function insertEmoji(
  text,
  emoji,
  selectionStart,
  selectionEnd,
  maxLength = MAX_MESSAGE_LENGTH
) {
  const value = typeof text === "string" ? text : "";

  const clamp = (position) =>
    Number.isInteger(position)
      ? Math.max(0, Math.min(position, value.length))
      : value.length;

  const start = clamp(selectionStart);
  const end = Math.max(start, clamp(selectionEnd));

  const unchanged = {
    text: value,
    cursor: start,
    inserted: false,
  };

  if (typeof emoji !== "string" || !emoji) {
    return unchanged;
  }

  const nextLength =
    value.length - (end - start) + emoji.length;

  if (nextLength > maxLength) {
    return unchanged;
  }

  return {
    text:
      value.slice(0, start) +
      emoji +
      value.slice(end),

    cursor: start + emoji.length,
    inserted: true,
  };
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

/* -------------------- MENTIONS -------------------- */

const MENTION_QUERY_PATTERN =
  /(?:^|[\s([{])@([A-Za-z0-9_]*)$/;

const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/;

export function getMentionQuery(
  text,
  selectionStart,
  selectionEnd = selectionStart
) {
  if (
    typeof text !== "string" ||
    !Number.isInteger(selectionStart) ||
    selectionStart !== selectionEnd ||
    selectionStart < 0 ||
    selectionStart > text.length
  ) {
    return null;
  }

  const beforeCursor = text.slice(
    0,
    selectionStart
  );

  const match = MENTION_QUERY_PATTERN.exec(
    beforeCursor
  );

  if (!match) return null;

  const query = match[1];

  // Include the remainder of an existing username
  // when editing a mention in the middle of a message.
  const remaining = text
    .slice(selectionStart)
    .match(/^[A-Za-z0-9_]*/)?.[0] ?? "";

  return {
    query,
    start: selectionStart - query.length - 1,
    end: selectionStart + remaining.length,
  };
}

export function getMentionSuggestions(
  members,
  query = ""
) {
  const search = query.toLowerCase();

  const matches = [];

  for (const member of members) {
    const profile = member.profile;
    const username = profile?.username;

    if (
      typeof username !== "string" ||
      !USERNAME_PATTERN.test(username)
    ) {
      continue;
    }

    const normalizedUsername =
      username.toLowerCase();

    const normalizedName =
      profile.display_name?.toLowerCase() ?? "";

    let score;

    if (normalizedUsername === search) {
      score = 0;
    } else if (
      normalizedUsername.startsWith(search)
    ) {
      score = 1;
    } else if (
      normalizedName.startsWith(search)
    ) {
      score = 2;
    } else if (
      normalizedUsername.includes(search) ||
      normalizedName.includes(search)
    ) {
      score = 3;
    } else {
      continue;
    }

    matches.push({
      profile,
      score,
    });
  }

  return matches
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.profile.username.localeCompare(
          b.profile.username
        )
    )
    .slice(0, MAX_MENTION_SUGGESTIONS)
    .map(({ profile }) => profile);
}

export function insertMention(
  text,
  username,
  mention,
  maxLength = MAX_MESSAGE_LENGTH
) {
  if (
    typeof text !== "string" ||
    typeof username !== "string" ||
    !USERNAME_PATTERN.test(username) ||
    !mention ||
    !Number.isInteger(mention.start) ||
    !Number.isInteger(mention.end) ||
    mention.start < 0 ||
    mention.end < mention.start ||
    mention.end > text.length ||
    text[mention.start] !== "@"
  ) {
    return null;
  }

  const before = text.slice(
    0,
    mention.start
  );

  const after = text.slice(
    mention.end
  );

  const token = `@${username}`;

  const separator =
    /^\s/.test(after) ? "" : " ";

  const inserted = token + separator;

  const nextText =
    before + inserted + after;

  if (nextText.length > maxLength) {
    return null;
  }

  return {
    text: nextText,
    cursor:
      before.length +
      inserted.length +
      (separator ? 0 : 1),
  };
}

/* -------------------- MENTION HIGHLIGHTING -------------------- */

const MENTION_TOKEN_PATTERN =
  /(^|[\s([{])@([A-Za-z0-9_]+)(?![A-Za-z0-9_])/g;

export function highlightMentionParts(
  parts,
  mentions
) {
  if (
    !Array.isArray(mentions) ||
    !mentions.length ||
    !parts.length
  ) {
    return parts;
  }

  const mentionsByUsername = new Map();

  for (const mention of mentions) {
    if (
      typeof mention?.username !== "string" ||
      typeof mention.user_id !== "string" ||
      !USERNAME_PATTERN.test(mention.username)
    ) {
      continue;
    }

    mentionsByUsername.set(
      mention.username,
      mention
    );
  }

  if (!mentionsByUsername.size) {
    return parts;
  }

  const result = [];

  let changed = false;

  for (const part of parts) {
    // Preserve links and other existing part types.
    if (
      part.type !== "text" ||
      !part.value.includes("@")
    ) {
      result.push(part);
      continue;
    }

    let offset = 0;

    for (const match of part.value.matchAll(
      MENTION_TOKEN_PATTERN
    )) {
      const prefix = match[1];
      const username = match[2];

      const mention =
        mentionsByUsername.get(username);

      if (!mention) continue;

      const start =
        match.index + prefix.length;

      const end =
        start + username.length + 1;

      if (start > offset) {
        result.push({
          type: "text",
          value: part.value.slice(
            offset,
            start
          ),
        });
      }

      result.push({
        type: "mention",
        value: part.value.slice(start, end),
        userId: mention.user_id,
        username,
      });

      offset = end;
      changed = true;
    }

    if (offset < part.value.length) {
      result.push({
        type: "text",
        value: part.value.slice(offset),
      });
    }
  }

  return changed ? result : parts;
}