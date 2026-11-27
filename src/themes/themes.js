// src/themes/themes.js

export const THEME_MODE = Object.freeze({
  SYSTEM: "system",
  LIGHT: "light",
  DARK: "dark",
  MIDNIGHT: "midnight",
  AMOLED: "amoled",
  FOREST: "forest",
  PURPLE: "purple",
  SLATE: "slate",
  WARM: "warm",
});

export const DEFAULT_THEME = THEME_MODE.DARK;

/* -------------------- THEME DEFINITIONS -------------------- */

export const THEMES = Object.freeze({
  light: {
    label: "Light",
    description: "Clean and bright",
    colorScheme: "light",

    colors: {
      background: "#f1f5f9",
      foreground: "#172033",

      surface: "#ffffff",
      surfaceSecondary: "#f8fafc",
      surfaceHover: "#e2e8f0",
      surfaceActive: "#dbeafe",

      border: "#dbe2ea",
      borderStrong: "#cbd5e1",

      muted: "#64748b",
      subtle: "#475569",

      input: "#ffffff",

      bubbleIncoming: "#e2e8f0",

      scrollbar: "#cbd5e1",
      scrollbarHover: "#94a3b8",
    },
  },

  dark: {
    label: "Dark",
    description: "Classic Messenger appearance",
    colorScheme: "dark",

    colors: {
      background: "#030712",
      foreground: "#f3f4f6",

      surface: "#111827",
      surfaceSecondary: "#1f2937",
      surfaceHover: "#263244",
      surfaceActive: "#374151",

      border: "#374151",
      borderStrong: "#4b5563",

      muted: "#9ca3af",
      subtle: "#d1d5db",

      input: "#111827",

      bubbleIncoming: "#1f2937",

      scrollbar: "#374151",
      scrollbarHover: "#4b5563",
    },
  },

  midnight: {
    label: "Midnight",
    description: "Deep navy blue",
    colorScheme: "dark",

    colors: {
      background: "#080e20",
      foreground: "#e2e8ff",

      surface: "#101b33",
      surfaceSecondary: "#16243e",
      surfaceHover: "#1b2b48",
      surfaceActive: "#243654",

      border: "#243654",
      borderStrong: "#364c70",

      muted: "#91a4c7",
      subtle: "#b6c5e0",

      input: "#101b33",

      bubbleIncoming: "#1b2b48",

      scrollbar: "#243654",
      scrollbarHover: "#364c70",
    },
  },

  amoled: {
    label: "AMOLED",
    description: "Pure black with minimal illumination",
    colorScheme: "dark",

    colors: {
      background: "#000000",
      foreground: "#fafafa",

      surface: "#090909",
      surfaceSecondary: "#111111",
      surfaceHover: "#191919",
      surfaceActive: "#242424",

      border: "#272727",
      borderStrong: "#404040",

      muted: "#a3a3a3",
      subtle: "#d4d4d4",

      input: "#0d0d0d",

      bubbleIncoming: "#191919",

      scrollbar: "#272727",
      scrollbarHover: "#404040",
    },
  },

  forest: {
    label: "Forest",
    description: "Deep natural greens",
    colorScheme: "dark",

    colors: {
      background: "#091810",
      foreground: "#e0f2e5",

      surface: "#11271b",
      surfaceSecondary: "#183324",
      surfaceHover: "#203c2b",
      surfaceActive: "#294634",

      border: "#294634",
      borderStrong: "#3d604a",

      muted: "#8eae98",
      subtle: "#b5d1bd",

      input: "#11271b",

      bubbleIncoming: "#203c2b",

      scrollbar: "#294634",
      scrollbarHover: "#3d604a",
    },
  },

  purple: {
    label: "Purple",
    description: "Rich violet tones",
    colorScheme: "dark",

    colors: {
      background: "#160d24",
      foreground: "#f0e6ff",

      surface: "#241535",
      surfaceSecondary: "#2e1c42",
      surfaceHover: "#39234f",
      surfaceActive: "#46315d",

      border: "#46315d",
      borderStrong: "#62467d",

      muted: "#b4a0ca",
      subtle: "#d5c4e9",

      input: "#241535",

      bubbleIncoming: "#39234f",

      scrollbar: "#46315d",
      scrollbarHover: "#62467d",
    },
  },

  slate: {
    label: "Slate",
    description: "Neutral blue-grey tones",
    colorScheme: "dark",

    colors: {
      background: "#1c232c",
      foreground: "#edf2f7",

      surface: "#28323e",
      surfaceSecondary: "#303c49",
      surfaceHover: "#384553",
      surfaceActive: "#435161",

      border: "#435161",
      borderStrong: "#596879",

      muted: "#a7b4c4",
      subtle: "#cbd5e1",

      input: "#28323e",

      bubbleIncoming: "#384553",

      scrollbar: "#435161",
      scrollbarHover: "#596879",
    },
  },

  warm: {
    label: "Warm",
    description: "Soft cream and earthy tones",
    colorScheme: "light",

    colors: {
      background: "#f0e8dc",
      foreground: "#493c30",

      surface: "#fff9ef",
      surfaceSecondary: "#f7efe3",
      surfaceHover: "#e9dece",
      surfaceActive: "#e2d4c0",

      border: "#ded0bc",
      borderStrong: "#c6b59e",

      muted: "#796653",
      subtle: "#665341",

      input: "#fff9ef",

      bubbleIncoming: "#e9dece",

      scrollbar: "#c6b59e",
      scrollbarHover: "#a8957e",
    },
  },
});

/* -------------------- THEME OPTIONS -------------------- */

export const THEME_OPTIONS = Object.freeze([
  {
    id: THEME_MODE.SYSTEM,
    label: "System",
    description: "Follow your device appearance",
  },

  ...Object.entries(THEMES).map(([id, theme]) => ({
    id,
    label: theme.label,
    description: theme.description,
  })),
]);

/* -------------------- VALIDATION -------------------- */

export function isValidTheme(theme) {
  return (
    typeof theme === "string" &&
    (
      theme === THEME_MODE.SYSTEM ||
      Object.hasOwn(THEMES, theme)
    )
  );
}

/* -------------------- RESOLUTION -------------------- */

export function resolveTheme(
  theme,
  prefersDark = true
) {
  if (!isValidTheme(theme)) {
    return DEFAULT_THEME;
  }

  if (theme === THEME_MODE.SYSTEM) {
    return prefersDark
      ? THEME_MODE.DARK
      : THEME_MODE.LIGHT;
  }

  return theme;
}

export function getTheme(
  theme,
  prefersDark = true
) {
  return THEMES[
    resolveTheme(theme, prefersDark)
  ];
}