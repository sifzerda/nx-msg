// src/themes/appearance.js

/* -------------------- STORAGE -------------------- */

export const APPEARANCE_STORAGE_KEY =
  "messenger-appearance";

export const APPEARANCE_STORAGE_VERSION = 1;

export const SYSTEM_THEME_QUERY =
  "(prefers-color-scheme: dark)";

/* -------------------- THEME FACTORY -------------------- */

const COLOR_KEYS = [
  "background",
  "foreground",
  "surface",
  "surface-secondary",
  "surface-hover",
  "surface-active",
  "border",
  "border-strong",
  "muted",
  "subtle",
  "input",
  "bubble-incoming",
  "scrollbar",
  "scrollbar-hover",
];

function createTheme(
  label,
  description,
  colorScheme,
  palette
) {
  return {
    label,
    description,
    colorScheme,
    colors: Object.fromEntries(
      COLOR_KEYS.map((key, index) => [
        key,
        palette[index],
      ])
    ),
  };
}

/* -------------------- THEMES -------------------- */

export const THEMES = Object.freeze({
  light: createTheme(
    "Light",
    "Clean and bright",
    "light",
    [
      "#f1f5f9", "#172033",
      "#ffffff", "#f8fafc",
      "#e2e8f0", "#dbeafe",
      "#dbe2ea", "#cbd5e1",
      "#64748b", "#475569",
      "#ffffff", "#e2e8f0",
      "#cbd5e1", "#94a3b8",
    ]
  ),

  dark: createTheme(
    "Dark",
    "Classic Messenger appearance",
    "dark",
    [
      "#030712", "#f3f4f6",
      "#111827", "#1f2937",
      "#263244", "#374151",
      "#374151", "#4b5563",
      "#9ca3af", "#d1d5db",
      "#111827", "#1f2937",
      "#374151", "#4b5563",
    ]
  ),

  midnight: createTheme(
    "Midnight",
    "Deep navy blue",
    "dark",
    [
      "#080e20", "#e2e8ff",
      "#101b33", "#16243e",
      "#1b2b48", "#243654",
      "#243654", "#364c70",
      "#91a4c7", "#b6c5e0",
      "#101b33", "#1b2b48",
      "#243654", "#364c70",
    ]
  ),

  amoled: createTheme(
    "AMOLED",
    "Pure black with minimal illumination",
    "dark",
    [
      "#000000", "#fafafa",
      "#090909", "#111111",
      "#191919", "#242424",
      "#272727", "#404040",
      "#a3a3a3", "#d4d4d4",
      "#0d0d0d", "#191919",
      "#272727", "#404040",
    ]
  ),

  forest: createTheme(
    "Forest",
    "Deep natural greens",
    "dark",
    [
      "#091810", "#e0f2e5",
      "#11271b", "#183324",
      "#203c2b", "#294634",
      "#294634", "#3d604a",
      "#8eae98", "#b5d1bd",
      "#11271b", "#203c2b",
      "#294634", "#3d604a",
    ]
  ),

  purple: createTheme(
    "Purple",
    "Rich violet tones",
    "dark",
    [
      "#160d24", "#f0e6ff",
      "#241535", "#2e1c42",
      "#39234f", "#46315d",
      "#46315d", "#62467d",
      "#b4a0ca", "#d5c4e9",
      "#241535", "#39234f",
      "#46315d", "#62467d",
    ]
  ),

  slate: createTheme(
    "Slate",
    "Neutral blue-grey tones",
    "dark",
    [
      "#1c232c", "#edf2f7",
      "#28323e", "#303c49",
      "#384553", "#435161",
      "#435161", "#596879",
      "#a7b4c4", "#cbd5e1",
      "#28323e", "#384553",
      "#435161", "#596879",
    ]
  ),

  warm: createTheme(
    "Warm",
    "Soft cream and earthy tones",
    "light",
    [
      "#f0e8dc", "#493c30",
      "#fff9ef", "#f7efe3",
      "#e9dece", "#e2d4c0",
      "#ded0bc", "#c6b59e",
      "#796653", "#665341",
      "#fff9ef", "#e9dece",
      "#c6b59e", "#a8957e",
    ]
  ),
});

/* -------------------- ACCENT COLORS -------------------- */

function createAccent(label, color, hover) {
  return {
    label,
    color,
    hover,
    foreground: "#ffffff",
  };
}

export const ACCENT_COLORS = Object.freeze({
  blue: createAccent(
    "Blue", "#2563eb", "#1d4ed8"
  ),

  purple: createAccent(
    "Purple", "#7c3aed", "#6d28d9"
  ),

  pink: createAccent(
    "Pink", "#db2777", "#be185d"
  ),

  red: createAccent(
    "Red", "#dc2626", "#b91c1c"
  ),

  orange: createAccent(
    "Orange", "#c2410c", "#9a3412"
  ),

  teal: createAccent(
    "Teal", "#0f766e", "#115e59"
  ),

  green: createAccent(
    "Green", "#15803d", "#166534"
  ),

  slate: createAccent(
    "Slate", "#475569", "#334155"
  ),
});

/* -------------------- MESSAGE FONT SIZE -------------------- */

export const MESSAGE_FONT_SIZE = Object.freeze({
  MIN: 12,
  MAX: 20,
  DEFAULT: 14,
  STEP: 1,
});

/* -------------------- BUBBLE SHAPES -------------------- */

export const BUBBLE_SHAPES = Object.freeze({
  rounded: {
    label: "Rounded",
    description: "Soft, rounded message bubbles",
    radius: "16px",
  },

  square: {
    label: "Square",
    description: "More angular message bubbles",
    radius: "4px",
  },
});

/* -------------------- DEFAULTS -------------------- */

export const DEFAULT_APPEARANCE = Object.freeze({
  theme: "dark",
  accent: "blue",
  messageFontSize: MESSAGE_FONT_SIZE.DEFAULT,
  bubbleShape: "rounded",
});

/* -------------------- SHARED CONFIGURATION -------------------- */

export const APPEARANCE_CONFIG = Object.freeze({
  defaults: DEFAULT_APPEARANCE,
  themes: THEMES,
  accents: ACCENT_COLORS,
  bubbleShapes: BUBBLE_SHAPES,
  fontSize: MESSAGE_FONT_SIZE,
  storageKey: APPEARANCE_STORAGE_KEY,
  systemQuery: SYSTEM_THEME_QUERY,
});

/* -------------------- VALIDATION -------------------- */

export function sanitizeAppearance(
  preferences,
  config = APPEARANCE_CONFIG
) {
  const value =
    preferences &&
    typeof preferences === "object" &&
    !Array.isArray(preferences)
      ? preferences
      : {};

  const {
    defaults,
    themes,
    accents,
    bubbleShapes,
    fontSize,
  } = config;

  const validTheme =
    typeof value.theme === "string" &&
    (
      value.theme === "system" ||
      Object.hasOwn(themes, value.theme)
    );

  const validAccent =
    typeof value.accent === "string" &&
    Object.hasOwn(accents, value.accent);

  const validBubbleShape =
    typeof value.bubbleShape === "string" &&
    Object.hasOwn(bubbleShapes, value.bubbleShape);

  const validFontSize =
    typeof value.messageFontSize === "number" &&
    Number.isFinite(value.messageFontSize);

  return {
    theme: validTheme
      ? value.theme
      : defaults.theme,

    accent: validAccent
      ? value.accent
      : defaults.accent,

    messageFontSize: validFontSize
      ? Math.max(
          fontSize.MIN,
          Math.min(
            fontSize.MAX,
            Math.round(value.messageFontSize)
          )
        )
      : defaults.messageFontSize,

    bubbleShape: validBubbleShape
      ? value.bubbleShape
      : defaults.bubbleShape,
  };
}

/* -------------------- SYSTEM THEME -------------------- */

export function getSystemPrefersDark() {
  return (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  )
    ? true
    : window.matchMedia(SYSTEM_THEME_QUERY).matches;
}

export function resolveTheme(
  theme,
  prefersDark = true
) {
  if (theme === "system") {
    return prefersDark ? "dark" : "light";
  }

  return Object.hasOwn(THEMES, theme)
    ? theme
    : DEFAULT_APPEARANCE.theme;
}

/* -------------------- DEFAULT COMPARISON -------------------- */

export function isDefaultAppearance(preferences) {
  if (!preferences) return false;

  return Object.keys(DEFAULT_APPEARANCE).every(
    (key) =>
      preferences[key] === DEFAULT_APPEARANCE[key]
  );
}

/* -------------------- APPLY APPEARANCE -------------------- */

export function applyAppearance(
  preferences,
  root,
  prefersDark = true,
  config = APPEARANCE_CONFIG
) {
  if (!root) return;

  const resolvedTheme =
    preferences.theme === "system"
      ? prefersDark
        ? "dark"
        : "light"
      : preferences.theme;

  const theme =
    config.themes[resolvedTheme] ||
    config.themes[config.defaults.theme];

  const accent =
    config.accents[preferences.accent] ||
    config.accents[config.defaults.accent];

  const bubbleShape =
    config.bubbleShapes[preferences.bubbleShape] ||
    config.bubbleShapes[config.defaults.bubbleShape];

  root.dataset.theme = resolvedTheme;
  root.dataset.themeMode = preferences.theme;
  root.dataset.accent = preferences.accent;
  root.dataset.bubbleShape = preferences.bubbleShape;

  root.style.colorScheme = theme.colorScheme;

  const variables = {
    ...theme.colors,

    accent: accent.color,
    "accent-hover": accent.hover,
    "accent-foreground": accent.foreground,

    "bubble-outgoing": accent.color,
    "bubble-outgoing-foreground": accent.foreground,

    "message-font-size":
      `${preferences.messageFontSize}px`,

    "message-bubble-radius":
      bubbleShape.radius,
  };

  for (const [key, value] of Object.entries(variables)) {
    const property = `--${key}`;

    if (root.style.getPropertyValue(property) !== value) {
      root.style.setProperty(property, value);
    }
  }
}