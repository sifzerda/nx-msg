// src/store/useAppearanceStore.js

"use client";

import { create } from "zustand";

import {
  persist,
  createJSONStorage,
} from "zustand/middleware";

import { isValidTheme } from "@/theme/themes";
import { isValidAccent } from "@/theme/accentColors";

import {
  APPEARANCE_STORAGE_KEY,
  APPEARANCE_STORAGE_VERSION,
  DEFAULT_APPEARANCE,
  MESSAGE_FONT_SIZE,
} from "@/constants/appearance";

import {
  isValidBubbleShape,
  normalizeMessageFontSize,
  sanitizeAppearance,
} from "@/utils/appearanceValidation";

/* -------------------- STORE -------------------- */

const useAppearanceStore = create(
  persist(
    (set, get) => ({
      /* -------------------- STATE -------------------- */

      ...DEFAULT_APPEARANCE,

      hasHydrated: false,

      /* -------------------- HYDRATION -------------------- */

      setHasHydrated: (hasHydrated) => {
        const value = Boolean(hasHydrated);

        if (get().hasHydrated === value) return;

        set({ hasHydrated: value });
      },

      /* -------------------- THEME -------------------- */

      setTheme: (theme) => {
        if (!isValidTheme(theme)) return;

        if (get().theme === theme) return;

        set({ theme });
      },

      /* -------------------- ACCENT -------------------- */

      setAccent: (accent) => {
        if (!isValidAccent(accent)) return;

        if (get().accent === accent) return;

        set({ accent });
      },

      /* -------------------- FONT SIZE -------------------- */

      setMessageFontSize: (value) => {
        if (
          typeof value !== "number" ||
          !Number.isFinite(value)
        ) {
          return;
        }

        const messageFontSize =
          normalizeMessageFontSize(value);

        if (
          get().messageFontSize === messageFontSize
        ) {
          return;
        }

        set({ messageFontSize });
      },

      increaseMessageFontSize: () => {
        const {
          messageFontSize,
          setMessageFontSize,
        } = get();

        setMessageFontSize(
          messageFontSize + MESSAGE_FONT_SIZE.STEP
        );
      },

      decreaseMessageFontSize: () => {
        const {
          messageFontSize,
          setMessageFontSize,
        } = get();

        setMessageFontSize(
          messageFontSize - MESSAGE_FONT_SIZE.STEP
        );
      },

      /* -------------------- BUBBLE SHAPE -------------------- */

      setBubbleShape: (bubbleShape) => {
        if (!isValidBubbleShape(bubbleShape)) return;

        if (get().bubbleShape === bubbleShape) return;

        set({ bubbleShape });
      },

      /* -------------------- BULK UPDATE -------------------- */

      updateAppearance: (preferences) => {
        if (
          !preferences ||
          typeof preferences !== "object" ||
          Array.isArray(preferences)
        ) {
          return;
        }

        const current = get();

        const next = sanitizeAppearance({
          theme: current.theme,
          accent: current.accent,
          messageFontSize: current.messageFontSize,
          bubbleShape: current.bubbleShape,
          ...preferences,
        });

        const unchanged =
          current.theme === next.theme &&
          current.accent === next.accent &&
          current.messageFontSize ===
            next.messageFontSize &&
          current.bubbleShape === next.bubbleShape;

        if (unchanged) return;

        set(next);
      },

      /* -------------------- INDIVIDUAL RESETS -------------------- */

      resetTheme: () => {
        get().setTheme(DEFAULT_APPEARANCE.theme);
      },

      resetAccent: () => {
        get().setAccent(DEFAULT_APPEARANCE.accent);
      },

      resetMessageFontSize: () => {
        get().setMessageFontSize(
          DEFAULT_APPEARANCE.messageFontSize
        );
      },

      resetBubbleShape: () => {
        get().setBubbleShape(
          DEFAULT_APPEARANCE.bubbleShape
        );
      },

      /* -------------------- FULL RESET -------------------- */

      reset: () => {
        get().updateAppearance(DEFAULT_APPEARANCE);
      },
    }),

    /* -------------------- PERSISTENCE -------------------- */

    {
      name: APPEARANCE_STORAGE_KEY,

      version: APPEARANCE_STORAGE_VERSION,

      storage: createJSONStorage(
        () => localStorage
      ),

      // Hydrate explicitly from the ThemeProvider.
      // This avoids server/client preference mismatches.
      skipHydration: true,

      /* -------------------- SAVED FIELDS -------------------- */

      partialize: (state) => ({
        theme: state.theme,
        accent: state.accent,
        messageFontSize: state.messageFontSize,
        bubbleShape: state.bubbleShape,
      }),

      /* -------------------- MIGRATION -------------------- */

      migrate: (persistedState) => {
        return sanitizeAppearance(persistedState);
      },

      /* -------------------- MERGE -------------------- */

      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizeAppearance(persistedState),
      }),

      /* -------------------- HYDRATION CALLBACK -------------------- */

      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            console.warn(
              "Unable to restore appearance preferences:",
              error
            );
          }
        };
      },
    }
  )
);

export default useAppearanceStore;