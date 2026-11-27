// src/theme/appearanceScript.js

import {
  THEMES,
  THEME_MODE,
} from "./themes";

import {
  ACCENT_COLORS,
} from "./accentColors";

import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  MESSAGE_FONT_SIZE,
  BUBBLE_SHAPES,
} from "@/constants/appearance";

import {
  THEME_VARIABLES,
  SYSTEM_THEME_QUERY,
} from "./applyAppearance";

/* -------------------- SCRIPT CONFIGURATION -------------------- */

const SCRIPT_CONFIG = {
  storageKey: APPEARANCE_STORAGE_KEY,

  defaults: DEFAULT_APPEARANCE,

  themes: THEMES,

  accents: ACCENT_COLORS,

  bubbleShapes: BUBBLE_SHAPES,

  fontSize: MESSAGE_FONT_SIZE,

  variables: THEME_VARIABLES,

  systemTheme: THEME_MODE.SYSTEM,

  lightTheme: THEME_MODE.LIGHT,

  darkTheme: THEME_MODE.DARK,

  systemQuery: SYSTEM_THEME_QUERY,
};

/* -------------------- SAFE SERIALIZATION -------------------- */

function serializeConfig(config) {
  return JSON.stringify(config)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/* -------------------- SCRIPT GENERATOR -------------------- */

export function createAppearanceScript() {
  const config = serializeConfig(SCRIPT_CONFIG);

  return `
    (function () {
      "use strict";

      try {
        var config = ${config};

        var root = document.documentElement;

        var defaults = config.defaults;

        var saved = {};

        /* -------------------- RESTORE STORAGE -------------------- */

        try {
          var raw = window.localStorage.getItem(
            config.storageKey
          );

          if (raw) {
            var parsed = JSON.parse(raw);

            if (
              parsed &&
              parsed.state &&
              typeof parsed.state === "object" &&
              !Array.isArray(parsed.state)
            ) {
              saved = parsed.state;
            }
          }
        } catch (_) {
          // Storage may be unavailable or corrupted.
          // Continue using default preferences.
        }

        /* -------------------- VALIDATION -------------------- */

        function hasOwn(object, key) {
          return (
            typeof key === "string" &&
            Object.prototype.hasOwnProperty.call(
              object,
              key
            )
          );
        }

        var theme =
          saved.theme === config.systemTheme ||
          hasOwn(config.themes, saved.theme)
            ? saved.theme
            : defaults.theme;

        var accent = hasOwn(
          config.accents,
          saved.accent
        )
          ? saved.accent
          : defaults.accent;

        var bubbleShape = hasOwn(
          config.bubbleShapes,
          saved.bubbleShape
        )
          ? saved.bubbleShape
          : defaults.bubbleShape;

        var messageFontSize =
          typeof saved.messageFontSize === "number" &&
          Number.isFinite(saved.messageFontSize)
            ? Math.max(
                config.fontSize.MIN,
                Math.min(
                  config.fontSize.MAX,
                  Math.round(saved.messageFontSize)
                )
              )
            : defaults.messageFontSize;

        /* -------------------- SYSTEM THEME -------------------- */

        var resolvedTheme = theme;

        if (theme === config.systemTheme) {
          var prefersDark = true;

          if (
            typeof window.matchMedia === "function"
          ) {
            prefersDark = window.matchMedia(
              config.systemQuery
            ).matches;
          }

          resolvedTheme = prefersDark
            ? config.darkTheme
            : config.lightTheme;
        }

        /* -------------------- RESOLVE PALETTES -------------------- */

        var themeDefinition =
          config.themes[resolvedTheme];

        var accentDefinition =
          config.accents[accent];

        var bubbleDefinition =
          config.bubbleShapes[bubbleShape];

        /* -------------------- DOCUMENT ATTRIBUTES -------------------- */

        root.dataset.theme = resolvedTheme;
        root.dataset.themeMode = theme;
        root.dataset.accent = accent;
        root.dataset.bubbleShape = bubbleShape;

        root.style.colorScheme =
          themeDefinition.colorScheme;

        /* -------------------- THEME VARIABLES -------------------- */

        Object.keys(config.variables).forEach(
          function (key) {
            root.style.setProperty(
              config.variables[key],
              themeDefinition.colors[key]
            );
          }
        );

        /* -------------------- ACCENT VARIABLES -------------------- */

        root.style.setProperty(
          "--accent",
          accentDefinition.color
        );

        root.style.setProperty(
          "--accent-hover",
          accentDefinition.hover
        );

        root.style.setProperty(
          "--accent-foreground",
          accentDefinition.foreground
        );

        /* -------------------- MESSAGE VARIABLES -------------------- */

        root.style.setProperty(
          "--message-font-size",
          messageFontSize + "px"
        );

        root.style.setProperty(
          "--message-bubble-radius",
          bubbleDefinition.radius
        );

      } catch (error) {
        console.warn(
          "Unable to initialize appearance:",
          error
        );
      }
    })();
  `;
}

/* -------------------- GENERATED SCRIPT -------------------- */

export const APPEARANCE_SCRIPT =
  createAppearanceScript();