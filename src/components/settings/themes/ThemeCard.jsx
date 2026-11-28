// src/components/settings/themes/ThemeCard.jsx

"use client";

import { memo } from "react";
import { CheckCircle2 } from "lucide-react";
import ThemePreview from "./ThemePreview";
import { THEME_MODE } from "@/themes/themes";

/* -------------------- THEME CARD -------------------- */

function ThemeCard({
  option,
  name,
  selected,
  accentId,
  resolvedTheme,
  disabled = false,
  onSelect,
}) {
  const isSystem = option.id === THEME_MODE.SYSTEM;
  const systemDescription = resolvedTheme === THEME_MODE.DARK
      ? "Currently using Dark"
      : "Currently using Light";

  return (
    <label
      className={`relative block ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer"
      }`}
    >
      {/* Accessible radio input */}

      <input
        type="radio"
        name={name}
        value={option.id}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(option.id)}
        className="peer sr-only"
      />

      {/* Visible card */}

      <div
        className={`
          h-full space-y-3 rounded-xl border-2 p-2.5
          transition-colors
          peer-focus-visible:outline-2
          peer-focus-visible:outline-offset-2
          peer-focus-visible:outline-accent
          ${
            selected
              ? "border-accent bg-surface-active"
              : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover"
          }
        `}
      >
        {/* Theme preview */}

        <ThemePreview
          themeId={option.id}
          accentId={accentId}
        />

        {/* Theme information */}

        <div className="space-y-1">

          <div className="flex items-center justify-between gap-2">

            <span className="truncate text-sm font-semibold text-foreground">
              {option.label}
            </span>

            {selected && (
              <CheckCircle2
                size={17}
                aria-hidden="true"
                className="shrink-0 text-accent"
              />
            )}

          </div>

          <p className="text-xs leading-relaxed text-muted">
            {option.description}
          </p>

          {isSystem && (
            <p className="text-xs font-medium text-subtle">
              {systemDescription}
            </p>
          )}

        </div>
      </div>
    </label>
  );
}

export default memo(ThemeCard);