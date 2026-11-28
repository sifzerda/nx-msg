// src/constants/messages.js

/* -------------------- MESSAGE LIMITS -------------------- */

export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_NOTIFICATION_LENGTH = 150;
export const MAX_MENTION_SUGGESTIONS = 8;
/* -------------------- COMPOSER -------------------- */

export const COMPOSER_PICKER = Object.freeze({
  GIF: "gif",
  EMOJI: "emoji",
});

/* -------------------- REACTIONS -------------------- */

export const REACTION_LABELS = Object.freeze({
  "👍": "Like",
  "❤️": "Love",
  "😂": "Laugh",
  "😮": "Surprised",
  "😢": "Sad",
  "😡": "Angry",
  "🎉": "Celebrate",
});

export const QUICK_REACTIONS = Object.freeze(
  Object.keys(REACTION_LABELS)
);