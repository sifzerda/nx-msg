// src/store/useAppearanceStore.js

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  APPEARANCE_STORAGE_KEY,
  APPEARANCE_STORAGE_VERSION,
  DEFAULT_APPEARANCE,
  MESSAGE_FONT_SIZE,
  sanitizeAppearance,
} from "@/themes/appearance";

const storage = createJSONStorage(() => ({
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Preferences remain available in memory.
    }
  },

  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage may be unavailable.
    }
  },
}));

const preferenceKeys = Object.keys(DEFAULT_APPEARANCE);

const useAppearanceStore = create(
  persist(
    (set, get) => {
      function updateAppearance(preferences) {
        if (!preferences || typeof preferences !== "object") return;

        const current = get();

        const next = sanitizeAppearance({
          ...current,
          ...preferences,
        });

        if (preferenceKeys.some((key) => current[key] !== next[key])) {
          set(next);
        }
      }

      return {
        ...DEFAULT_APPEARANCE,

        hasHydrated: false,

        setHasHydrated: (value) => {
          if (get().hasHydrated !== Boolean(value)) {
            set({ hasHydrated: Boolean(value) });
          }
        },

        updateAppearance,

        setTheme: (theme) => updateAppearance({ theme }),

        setAccent: (accent) => updateAppearance({ accent }),

        setBubbleShape: (bubbleShape) =>
          updateAppearance({ bubbleShape }),

        setMessageFontSize: (messageFontSize) =>
          updateAppearance({ messageFontSize }),

        increaseMessageFontSize: () =>
          updateAppearance({
            messageFontSize:
              get().messageFontSize + MESSAGE_FONT_SIZE.STEP,
          }),

        decreaseMessageFontSize: () =>
          updateAppearance({
            messageFontSize:
              get().messageFontSize - MESSAGE_FONT_SIZE.STEP,
          }),

        resetTheme: () =>
          updateAppearance({ theme: DEFAULT_APPEARANCE.theme }),

        resetAccent: () =>
          updateAppearance({ accent: DEFAULT_APPEARANCE.accent }),

        resetBubbleShape: () =>
          updateAppearance({
            bubbleShape: DEFAULT_APPEARANCE.bubbleShape,
          }),

        resetMessageFontSize: () =>
          updateAppearance({
            messageFontSize: DEFAULT_APPEARANCE.messageFontSize,
          }),

        reset: () => updateAppearance(DEFAULT_APPEARANCE),
      };
    },
    {
      name: APPEARANCE_STORAGE_KEY,
      version: APPEARANCE_STORAGE_VERSION,
      storage,
      skipHydration: true,

      partialize: (state) => sanitizeAppearance(state),

      migrate: (state) => sanitizeAppearance(state),

      merge: (persisted, current) => ({
        ...current,
        ...sanitizeAppearance(persisted),
      }),
    }
  )
);

export default useAppearanceStore;