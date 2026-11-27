// src/themes/accentColors.js

export const DEFAULT_ACCENT = "blue";

export const ACCENT_COLORS = Object.freeze({
  blue: {
    label: "Blue",
    color: "#2563eb",
    hover: "#1d4ed8",
    foreground: "#ffffff",
  },

  purple: {
    label: "Purple",
    color: "#7c3aed",
    hover: "#6d28d9",
    foreground: "#ffffff",
  },

  pink: {
    label: "Pink",
    color: "#db2777",
    hover: "#be185d",
    foreground: "#ffffff",
  },

  red: {
    label: "Red",
    color: "#dc2626",
    hover: "#b91c1c",
    foreground: "#ffffff",
  },

  orange: {
    label: "Orange",
    color: "#c2410c",
    hover: "#9a3412",
    foreground: "#ffffff",
  },

  teal: {
    label: "Teal",
    color: "#0f766e",
    hover: "#115e59",
    foreground: "#ffffff",
  },

  green: {
    label: "Green",
    color: "#15803d",
    hover: "#166534",
    foreground: "#ffffff",
  },

  slate: {
    label: "Slate",
    color: "#475569",
    hover: "#334155",
    foreground: "#ffffff",
  },
});

/* -------------------- OPTIONS -------------------- */

export const ACCENT_OPTIONS = Object.freeze(
  Object.entries(ACCENT_COLORS).map(
    ([id, accent]) => ({
      id,
      ...accent,
    })
  )
);

/* -------------------- VALIDATION -------------------- */

export function isValidAccent(accent) {
  return (
    typeof accent === "string" &&
    Object.hasOwn(ACCENT_COLORS, accent)
  );
}

export function getAccent(accent) {
  return ACCENT_COLORS[
    isValidAccent(accent)
      ? accent
      : DEFAULT_ACCENT
  ];
}