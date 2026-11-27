// src/components/settings/themes/AccentColorCard.jsx

"use client";

import { memo } from "react";

import { Check } from "lucide-react";

/* -------------------- ACCENT COLOUR CARD -------------------- */

function AccentColorCard({
  option,
  name,
  selected,
  disabled = false,
  onSelect,
}) {
  return (
    <label
      className={`relative block ${
        disabled
          ? "cursor-not-allowed opacity-50"
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
          flex h-full flex-col items-center
          justify-center gap-3 rounded-xl
          border-2 px-2 py-4
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
        {/* Colour swatch */}

        <div
          aria-hidden="true"
          className="
            flex size-11 shrink-0 items-center
            justify-center rounded-full
            shadow-sm sm:size-12
          "
          style={{
            backgroundColor: option.color,
            color: option.foreground,
          }}
        >
          {selected && (
            <Check
              size={24}
              strokeWidth={2.5}
            />
          )}
        </div>

        {/* Colour name */}

        <span
          className={`text-center text-sm ${
            selected
              ? "font-semibold text-foreground"
              : "font-medium text-subtle"
          }`}
        >
          {option.label}
        </span>

        {/* Hexadecimal value */}

        <span
          aria-hidden="true"
          className="font-mono text-[10px] uppercase text-muted"
        >
          {option.color}
        </span>

      </div>
    </label>
  );
}

export default memo(AccentColorCard);