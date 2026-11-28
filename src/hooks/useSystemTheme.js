// src/hooks/useSystemTheme.js

"use client";

import { useSyncExternalStore } from "react";

import {
  SYSTEM_THEME_QUERY,
  getSystemPrefersDark,
} from "@/themes/applyAppearance";

/* -------------------- SUBSCRIPTION -------------------- */

function subscribe(onChange) {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {};
  }

  const mediaQuery = window.matchMedia(
    SYSTEM_THEME_QUERY
  );

  if (
    typeof mediaQuery.addEventListener === "function"
  ) {
    mediaQuery.addEventListener("change", onChange);

    return () => {
      mediaQuery.removeEventListener(
        "change",
        onChange
      );
    };
  }

  // Compatibility with older browsers.

  if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(onChange);

    return () => {
      mediaQuery.removeListener(onChange);
    };
  }

  return () => {};
}

/* -------------------- SERVER SNAPSHOT -------------------- */

function getServerSnapshot() {
  return true;
}

/* -------------------- HOOK -------------------- */

export default function useSystemTheme() {
  return useSyncExternalStore(
    subscribe,
    getSystemPrefersDark,
    getServerSnapshot
  );
}