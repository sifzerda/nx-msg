// src/themeS/applyAppearance.js

import { getTheme, resolveTheme } from "./themes";
import { getAccent } from "./accentColors";

import {
  sanitizeAppearance,
  getBubbleRadius,
} from "@/utils/appearanceValidation";

/* -------------------- SYSTEM PREFERENCE -------------------- */

export const SYSTEM_THEME_QUERY =
  "(prefers-color-scheme: dark)";

export function getSystemPrefersDark() {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return true;
  }

  return window.matchMedia(
    SYSTEM_THEME_QUERY
  ).matches;
}

/* -------------------- CSS VARIABLE MAPPING -------------------- */

export const THEME_VARIABLES = Object.freeze({
  background: "--background",
  foreground: "--foreground",

  surface: "--surface",
  surfaceSecondary: "--surface-secondary",
  surfaceHover: "--surface-hover",
  surfaceActive: "--surface-active",

  border: "--border",
  borderStrong: "--border-strong",

  muted: "--muted",
  subtle: "--subtle",

  input: "--input",

  bubbleIncoming: "--bubble-incoming",

  scrollbar: "--scrollbar",
  scrollbarHover: "--scrollbar-hover",
});

/* -------------------- RESOLVE APPEARANCE -------------------- */

export function resolveAppearance(
  preferences,
  prefersDark = getSystemPrefersDark()
) {
  const appearance = sanitizeAppearance(preferences);

  const resolvedTheme = resolveTheme(
    appearance.theme,
    prefersDark
  );

  const theme = getTheme(
    resolvedTheme,
    prefersDark
  );

  const accent = getAccent(appearance.accent);

  const variables = {};

  for (const [key, variable] of Object.entries(
    THEME_VARIABLES
  )) {
    variables[variable] = theme.colors[key];
  }

  variables["--accent"] = accent.color;
  variables["--accent-hover"] = accent.hover;
  variables["--accent-foreground"] =
    accent.foreground;

  variables["--message-font-size"] =
    `${appearance.messageFontSize}px`;

  variables["--message-bubble-radius"] =
    getBubbleRadius(appearance.bubbleShape);

  return {
    appearance,
    resolvedTheme,
    colorScheme: theme.colorScheme,
    variables,
  };
}

/* -------------------- APPLY CSS VARIABLES -------------------- */

export function applyAppearance(
  preferences,
  {
    prefersDark = getSystemPrefersDark(),

    root =
      typeof document !== "undefined"
        ? document.documentElement
        : null,
  } = {}
) {
  const resolved = resolveAppearance(
    preferences,
    prefersDark
  );

  if (!root) {
    return resolved;
  }

  const {
    appearance,
    resolvedTheme,
    colorScheme,
    variables,
  } = resolved;

  /* -------------------- DOCUMENT ATTRIBUTES -------------------- */

  root.dataset.theme = resolvedTheme;
  root.dataset.themeMode = appearance.theme;
  root.dataset.accent = appearance.accent;
  root.dataset.bubbleShape = appearance.bubbleShape;

  root.style.colorScheme = colorScheme;

  /* -------------------- CSS VARIABLES -------------------- */

  for (const [property, value] of Object.entries(
    variables
  )) {
    if (
      root.style.getPropertyValue(property) !== value
    ) {
      root.style.setProperty(property, value);
    }
  }

  return resolved;
}