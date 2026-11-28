// src/utils/appearanceValidation.js

import { isValidTheme } from "@/themes/themes";
import { isValidAccent } from "@/themes/accentColors";

import {
  BUBBLE_SHAPES,
  MESSAGE_FONT_SIZE,
  DEFAULT_APPEARANCE,
} from "@/constants/appearance";

/* -------------------- BUBBLE VALIDATION -------------------- */

export function isValidBubbleShape(shape) {
  return (
    typeof shape === "string" &&
    Object.hasOwn(BUBBLE_SHAPES, shape)
  );
}

/* -------------------- FONT SIZE VALIDATION -------------------- */

export function normalizeMessageFontSize(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return MESSAGE_FONT_SIZE.DEFAULT;
  }

  return Math.max(
    MESSAGE_FONT_SIZE.MIN,
    Math.min(
      MESSAGE_FONT_SIZE.MAX,
      Math.round(value)
    )
  );
}

/* -------------------- PREFERENCE VALIDATION -------------------- */

export function sanitizeAppearance(preferences) {
  if (
    !preferences ||
    typeof preferences !== "object" ||
    Array.isArray(preferences)
  ) {
    return { ...DEFAULT_APPEARANCE };
  }

  return {
    theme: isValidTheme(preferences.theme)
      ? preferences.theme
      : DEFAULT_APPEARANCE.theme,

    accent: isValidAccent(preferences.accent)
      ? preferences.accent
      : DEFAULT_APPEARANCE.accent,

    messageFontSize: normalizeMessageFontSize(
      preferences.messageFontSize
    ),

    bubbleShape: isValidBubbleShape(
      preferences.bubbleShape
    )
      ? preferences.bubbleShape
      : DEFAULT_APPEARANCE.bubbleShape,
  };
}

/* -------------------- BUBBLE RADIUS -------------------- */

export function getBubbleRadius(shape) {
  const validShape = isValidBubbleShape(shape)
    ? shape
    : DEFAULT_APPEARANCE.bubbleShape;

  return BUBBLE_SHAPES[validShape].radius;
}

/* -------------------- DEFAULT COMPARISON -------------------- */

export function isDefaultAppearance(preferences) {
  if (!preferences) return false;

  return (
    preferences.theme ===
      DEFAULT_APPEARANCE.theme &&

    preferences.accent ===
      DEFAULT_APPEARANCE.accent &&

    preferences.messageFontSize ===
      DEFAULT_APPEARANCE.messageFontSize &&

    preferences.bubbleShape ===
      DEFAULT_APPEARANCE.bubbleShape
  );
}