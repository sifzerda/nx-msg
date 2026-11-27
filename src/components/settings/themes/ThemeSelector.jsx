// src/components/settings/themes/ThemeSelector.jsx

"use client";

import {
  memo,
  useId,
} from "react";

import {
  Palette,
  RotateCcw,
  Monitor,
  LoaderCircle,
} from "lucide-react";

import ThemeCard from "./ThemeCard";
import useAppearanceStore from "@/store/useAppearanceStore"
import useSystemTheme from "@/hooks/useSystemTheme";

import {
  THEME_MODE,
  THEME_OPTIONS,
  DEFAULT_THEME,
  resolveTheme,
  getTheme,
} from "@/theme/themes";

/* -------------------- LOADING STATE -------------------- */

const ThemeSelectorLoading = memo(
  function ThemeSelectorLoading() {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface p-8 text-sm text-muted"
      >
        <LoaderCircle
          size={18}
          className="animate-spin"
        />

        Loading appearance preferences...
      </div>
    );
  }
);

/* -------------------- THEME SELECTOR -------------------- */

function ThemeSelector() {
  const radioGroupName = useId();

  /* -------------------- STORE SELECTORS -------------------- */

  const theme = useAppearanceStore(
    (state) => state.theme
  );

  const accent = useAppearanceStore(
    (state) => state.accent
  );

  const hasHydrated = useAppearanceStore(
    (state) => state.hasHydrated
  );

  const setTheme = useAppearanceStore(
    (state) => state.setTheme
  );

  const resetTheme = useAppearanceStore(
    (state) => state.resetTheme
  );

  /* -------------------- SYSTEM THEME -------------------- */

  const prefersDark = useSystemTheme();

  const systemTheme = resolveTheme(
    THEME_MODE.SYSTEM,
    prefersDark
  );

  const activeTheme = resolveTheme(
    theme,
    prefersDark
  );

  const activeThemeDefinition =
    getTheme(activeTheme);

  const isSystem =
    theme === THEME_MODE.SYSTEM;

  const isDefault =
    theme === DEFAULT_THEME;

  /* -------------------- LOADING -------------------- */

  if (!hasHydrated) {
    return <ThemeSelectorLoading />;
  }

  /* -------------------- RENDER -------------------- */

  return (
    <fieldset className="min-w-0 space-y-4">

      <legend className="sr-only">
        Application theme
      </legend>

      {/* Section header */}

      <div className="flex flex-wrap items-start justify-between gap-3">

        <div className="flex items-start gap-3">

          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-secondary">
            <Palette
              size={20}
              className="text-subtle"
            />
          </div>

          <div>
            <h3 className="font-semibold text-foreground">
              Application theme
            </h3>

            <p className="mt-1 text-sm text-muted">
              Choose the colour scheme used throughout
              Messenger.
            </p>
          </div>

        </div>

        {/* Reset theme only */}

        <button
          type="button"
          onClick={resetTheme}
          disabled={isDefault}
          className="
            flex items-center gap-2 rounded-lg
            border border-border bg-surface
            px-3 py-2 text-xs font-medium text-subtle
            transition-colors
            hover:bg-surface-hover
            disabled:cursor-not-allowed
            disabled:opacity-40
          "
        >
          <RotateCcw size={14} />
          Reset theme
        </button>

      </div>

      {/* Theme cards */}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">

        {THEME_OPTIONS.map((option) => (
          <ThemeCard
            key={option.id}
            option={option}
            name={radioGroupName}
            selected={theme === option.id}
            accentId={accent}
            resolvedTheme={systemTheme}
            onSelect={setTheme}
          />
        ))}

      </div>

      {/* Active theme information */}

      <div
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-3 rounded-lg border border-border bg-surface-secondary p-3"
      >
        {isSystem ? (
          <Monitor
            size={18}
            className="shrink-0 text-subtle"
          />
        ) : (
          <Palette
            size={18}
            className="shrink-0 text-subtle"
          />
        )}

        <div className="min-w-0 flex-1">

          <p className="text-sm font-medium text-foreground">
            {isSystem
              ? `System — ${activeThemeDefinition.label}`
              : activeThemeDefinition.label}
          </p>

          <p className="mt-0.5 text-xs text-muted">
            {isSystem
              ? "Automatically follows your device appearance."
              : "This theme remains active regardless of your device appearance."}
          </p>

        </div>
      </div>

    </fieldset>
  );
}

export default memo(ThemeSelector);