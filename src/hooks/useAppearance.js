// src/hooks/useAppearance.js

"use client";

import { useShallow } from "zustand/react/shallow";
import useAppearanceStore from "@/store/useAppearanceStore";

export default function useAppearance() {
  return useAppearanceStore(
    useShallow((state) => ({
      theme: state.theme,
      accent: state.accent,
      messageFontSize: state.messageFontSize,
      bubbleShape: state.bubbleShape,
      hasHydrated: state.hasHydrated,
    }))
  );
}