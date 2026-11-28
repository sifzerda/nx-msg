// src/themes/appearanceScript.js

import {
  APPEARANCE_CONFIG,
  sanitizeAppearance,
  applyAppearance,
} from "./appearance";

export function createAppearanceScript() {
  const config = JSON.stringify(APPEARANCE_CONFIG)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  return `
    (() => {
      try {
        const config = ${config};
        const sanitize = (${sanitizeAppearance.toString()});
        const apply = (${applyAppearance.toString()});

        let saved = {};

        try {
          saved = JSON.parse(
            localStorage.getItem(config.storageKey)
          )?.state ?? {};
        } catch {}

        const preferences = sanitize(saved, config);

        const prefersDark =
          window.matchMedia?.(config.systemQuery)?.matches ?? true;

        apply(
          preferences,
          document.documentElement,
          prefersDark,
          config
        );
      } catch (error) {
        console.warn("Appearance initialisation failed:", error);
      }
    })();
  `;
}

export const APPEARANCE_SCRIPT = createAppearanceScript();