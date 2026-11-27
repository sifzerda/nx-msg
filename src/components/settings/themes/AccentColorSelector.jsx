// src/components/settings/themes/AccentColorSelector.jsx

"use client";

import {
  memo,
  useId,
} from "react";

import {
  Paintbrush,
  RotateCcw,
  LoaderCircle,
} from "lucide-react";

import AccentColorCard from "./AccentColorCard";
import AccentColorPreview from "./AccentColorPreview";

import useAppearanceStore from
  "@/store/useAppearanceStore";

import {
  ACCENT_OPTIONS,
  DEFAULT_ACCENT,
  getAccent,
} from "@/theme/accentColors";

/* -------------------- LOADING STATE -------------------- */

const AccentSelectorLoading = memo(
  function AccentSelectorLoading() {
    return (
      <div
        role="status"
        className="
          flex items-center justify-center gap-2
          rounded-xl border border-border
          bg-surface p-8 text-sm text-muted
        "
      >
        <LoaderCircle
          size={18}
          className="animate-spin"
        />

        Loading accent preferences...
      </div>
    );
  }
);

/* -------------------- ACCENT SELECTOR -------------------- */

function AccentColorSelector() {
  const radioGroupName = useId();

  /* -------------------- STORE SELECTORS -------------------- */

  const accent = useAppearanceStore(
    (state) => state.accent
  );

  const hasHydrated = useAppearanceStore(
    (state) => state.hasHydrated
  );

  const setAccent = useAppearanceStore(
    (state) => state.setAccent
  );

  const resetAccent = useAppearanceStore(
    (state) => state.resetAccent
  );

  /* -------------------- DERIVED STATE -------------------- */

  const selectedAccent = getAccent(accent);

  const isDefault =
    accent === DEFAULT_ACCENT;

  /* -------------------- LOADING -------------------- */

  if (!hasHydrated) {
    return <AccentSelectorLoading />;
  }

  /* -------------------- RENDER -------------------- */

  return (
    <fieldset className="min-w-0 space-y-4">

      <legend className="sr-only">
        Accent colour
      </legend>

      {/* Section header */}

      <div className="flex flex-wrap items-start justify-between gap-3">

        <div className="flex items-start gap-3">

          <div className="
            flex size-10 shrink-0 items-center
            justify-center rounded-lg border
            border-border bg-surface-secondary
          ">
            <Paintbrush
              size={20}
              className="text-subtle"
            />
          </div>

          <div className="min-w-0">

            <h3 className="font-semibold text-foreground">
              Accent colour
            </h3>

            <p className="mt-1 text-sm text-muted">
              Personalise buttons, messages and
              interactive highlights.
            </p>

          </div>

        </div>

        {/* Reset accent only */}

        <button
          type="button"
          onClick={resetAccent}
          disabled={isDefault}
          className="
            flex items-center gap-2 rounded-lg
            border border-border bg-surface
            px-3 py-2 text-xs font-medium
            text-subtle transition-colors
            hover:bg-surface-hover
            disabled:cursor-not-allowed
            disabled:opacity-40
          "
        >
          <RotateCcw size={14} />

          Reset accent
        </button>

      </div>

      {/* Accent colour cards */}

      <div className="
        grid grid-cols-2 gap-3
        sm:grid-cols-4
        2xl:grid-cols-8
      ">

        {ACCENT_OPTIONS.map((option) => (
          <AccentColorCard
            key={option.id}
            option={option}
            name={radioGroupName}
            selected={accent === option.id}
            onSelect={setAccent}
          />
        ))}

      </div>

      {/* Selected accent information */}

      <div
        aria-live="polite"
        aria-atomic="true"
        className="
          flex items-center gap-3 rounded-lg
          border border-border
          bg-surface-secondary p-3
        "
      >
        <div
          aria-hidden="true"
          className="size-9 shrink-0 rounded-full"
          style={{
            backgroundColor: selectedAccent.color,
          }}
        />

        <div className="min-w-0 flex-1">

          <p className="text-sm font-medium text-foreground">
            {selectedAccent.label}
          </p>

          <p className="mt-0.5 text-xs text-muted">
            Currently selected accent colour
          </p>

        </div>

        <span className="font-mono text-xs uppercase text-muted">
          {selectedAccent.color}
        </span>

      </div>

      {/* Live accent preview */}

      <AccentColorPreview
        accentId={accent}
      />

    </fieldset>
  );
}

export default memo(AccentColorSelector);