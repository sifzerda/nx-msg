// src/constants/appearance.js

import { DEFAULT_THEME } from "@/themes/themes";
import { DEFAULT_ACCENT } from "@/themes/accentColors";

/* -------------------- STORAGE -------------------- */

export const APPEARANCE_STORAGE_KEY = "messenger-appearance";
export const APPEARANCE_STORAGE_VERSION = 1;

/* -------------------- MESSAGE FONT SIZE -------------------- */

export const MESSAGE_FONT_SIZE = Object.freeze({
  MIN: 12,
  MAX: 20,
  DEFAULT: 14,
  STEP: 1,
});

/* -------------------- BUBBLE SHAPES -------------------- */

export const BUBBLE_SHAPE = Object.freeze({
  ROUNDED: "rounded",
  SQUARE: "square",
});

export const BUBBLE_SHAPES = Object.freeze({
  [BUBBLE_SHAPE.ROUNDED]: {
    label: "Rounded",
    description: "Soft, rounded message bubbles",
    radius: "16px",
  },

  [BUBBLE_SHAPE.SQUARE]: {
    label: "Square",
    description: "More angular message bubbles",
    radius: "4px",
  },
});

export const BUBBLE_SHAPE_OPTIONS = Object.freeze(
  Object.entries(BUBBLE_SHAPES).map(
    ([id, shape]) => ({
      id,
      ...shape,
    })
  )
);

/* -------------------- DEFAULT PREFERENCES -------------------- */

export const DEFAULT_APPEARANCE = Object.freeze({
  theme: DEFAULT_THEME,
  accent: DEFAULT_ACCENT,
  messageFontSize: MESSAGE_FONT_SIZE.DEFAULT,
  bubbleShape: BUBBLE_SHAPE.ROUNDED,
});