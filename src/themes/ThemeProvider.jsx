// src/themes/ThemeProvider.jsx

"use client";

import { useEffect } from "react";

import useAppearanceStore from "@/store/useAppearanceStore";

import {
  APPEARANCE_CONFIG,
  DEFAULT_APPEARANCE,
  SYSTEM_THEME_QUERY,
  sanitizeAppearance,
  applyAppearance,
  getSystemPrefersDark,
} from "./appearance";

const preferenceKeys = Object.keys(DEFAULT_APPEARANCE);

let hydrationRequest = null;

function hydrateAppearance() {
  if (useAppearanceStore.getState().hasHydrated) {
    return Promise.resolve();
  }

  if (!hydrationRequest) {
    hydrationRequest = Promise.resolve()
      .then(() => useAppearanceStore.persist.rehydrate())
      .catch((error) => {
        console.warn("Appearance restoration failed:", error);
      })
      .finally(() => {
        hydrationRequest = null;
        useAppearanceStore.getState().setHasHydrated(true);
      });
  }

  return hydrationRequest;
}

export default function ThemeProvider({ children }) {
  useEffect(() => {
    let active = true;

    function applyCurrentAppearance() {
      const state = useAppearanceStore.getState();

      if (!active || !state.hasHydrated) return;

      applyAppearance(
        sanitizeAppearance(state),
        document.documentElement,
        getSystemPrefersDark(),
        APPEARANCE_CONFIG
      );
    }

    const unsubscribe = useAppearanceStore.subscribe(
      (state, previous) => {
        if (
          state.hasHydrated &&
          (
            !previous.hasHydrated ||
            preferenceKeys.some(
              (key) => state[key] !== previous[key]
            )
          )
        ) {
          applyCurrentAppearance();
        }
      }
    );

    const mediaQuery = window.matchMedia?.(SYSTEM_THEME_QUERY);

    function handleSystemChange() {
      if (useAppearanceStore.getState().theme === "system") {
        applyCurrentAppearance();
      }
    }

    mediaQuery?.addEventListener("change", handleSystemChange);

    if (useAppearanceStore.getState().hasHydrated) {
      applyCurrentAppearance();
    } else {
      void hydrateAppearance();
    }

    return () => {
      active = false;
      unsubscribe();

      mediaQuery?.removeEventListener("change", handleSystemChange);
    };
  }, []);

  return children;
}