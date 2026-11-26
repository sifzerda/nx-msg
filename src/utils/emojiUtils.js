// src/utils/emojiUtils.js

import { MAX_MESSAGE_LENGTH } from "@/constants/emojis";

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

  const nextText =
    value.slice(0, start) +
    emoji +
    value.slice(end);

  if (nextText.length > maxLength) {
    return unchanged;
  }

  return {
    text: nextText,
    cursor: start + emoji.length,
    inserted: true,
  };
}