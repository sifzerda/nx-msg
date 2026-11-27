// src/themeS/ThemeProvider.jsx

"use client";

import { useEffect } from "react";

import useAppearanceStore from
  "@/store/useAppearanceStore";

import {
  applyAppearance,
  getSystemPrefersDark,
  SYSTEM_THEME_QUERY,
} from "./applyAppearance";

import { THEME_MODE } from "./themes";

/* -------------------- PREFERENCE COMPARISON -------------------- */

function hasAppearanceChanged(current, previous) {
  return (
    current.theme !== previous.theme ||
    current.accent !== previous.accent ||
    current.messageFontSize !==
      previous.messageFontSize ||
    current.bubbleShape !== previous.bubbleShape
  );
}

/* -------------------- HYDRATION -------------------- */

let hydrationRequest = null;

function hydrateAppearance() {
  if (useAppearanceStore.getState().hasHydrated) {
    return Promise.resolve();
  }

  if (hydrationRequest) {
    return hydrationRequest;
  }

  const request = Promise.resolve()
    .then(() => {
      return useAppearanceStore.persist?.rehydrate();
    })
    .catch((error) => {
      console.warn(
        "Appearance hydration failed:",
        error
      );
    })
    .finally(() => {
      useAppearanceStore
        .getState()
        .setHasHydrated(true);

      if (hydrationRequest === request) {
        hydrationRequest = null;
      }
    });

  hydrationRequest = request;

  return request;
}

/* -------------------- PROVIDER -------------------- */

export default function ThemeProvider({ children }) {
  useEffect(() => {
    let active = true;

    /* -------------------- APPLY CURRENT STATE -------------------- */

    function applyCurrentAppearance() {
      if (!active) return;

      const state = useAppearanceStore.getState();

      if (!state.hasHydrated) return;

      applyAppearance(state, {
        prefersDark: getSystemPrefersDark(),
      });
    }

    /* -------------------- STORE SUBSCRIPTION -------------------- */

    const unsubscribe = useAppearanceStore.subscribe(
      (current, previous) => {
        if (!active || !current.hasHydrated) {
          return;
        }

        if (
          !previous.hasHydrated ||
          hasAppearanceChanged(current, previous)
        ) {
          applyCurrentAppearance();
        }
      }
    );

    /* -------------------- SYSTEM THEME CHANGES -------------------- */

    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia(SYSTEM_THEME_QUERY)
        : null;

    function handleSystemThemeChange() {
      if (!active) return;

      const state = useAppearanceStore.getState();

      if (state.theme !== THEME_MODE.SYSTEM) {
        return;
      }

      applyCurrentAppearance();
    }

    if (mediaQuery) {
      if (
        typeof mediaQuery.addEventListener === "function"
      ) {
        mediaQuery.addEventListener(
          "change",
          handleSystemThemeChange
        );
      } else {
        mediaQuery.addListener?.(
          handleSystemThemeChange
        );
      }
    }

    /* -------------------- INITIALIZATION -------------------- */

    if (useAppearanceStore.getState().hasHydrated) {
      applyCurrentAppearance();
    } else {
      void hydrateAppearance().then(() => {
        if (active) {
          applyCurrentAppearance();
        }
      });
    }

    /* -------------------- CLEANUP -------------------- */

    return () => {
      active = false;

      unsubscribe();

      if (mediaQuery) {
        if (
          typeof mediaQuery.removeEventListener ===
          "function"
        ) {
          mediaQuery.removeEventListener(
            "change",
            handleSystemThemeChange
          );
        } else {
          mediaQuery.removeListener?.(
            handleSystemThemeChange
          );
        }
      }
    };
  }, []);

  return children;
}