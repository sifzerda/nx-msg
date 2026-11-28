// src/components/settings/AppearanceSettings.jsx

"use client";

import { useId } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  Palette,
  Check,
  CheckCheck,
  RotateCcw,
  Minus,
  Plus,
  Send,
  Paperclip,
  UserRound,
} from "lucide-react";

import useAppearanceStore from "@/store/useAppearanceStore";

import {
  THEMES,
  ACCENT_COLORS,
  BUBBLE_SHAPES,
  MESSAGE_FONT_SIZE,
  DEFAULT_APPEARANCE,
  isDefaultAppearance,
} from "@/themes/appearance";

const buttonClass =
  "flex items-center justify-center gap-2 rounded-lg border " +
  "border-border bg-surface px-3 py-2 text-sm text-foreground " +
  "hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40";

const themeOptions = [
  ["system", {
    label: "System",
    description: "Follow your device appearance",
  }],
  ...Object.entries(THEMES),
];

function SettingsGroup({
  title,
  description,
  onReset,
  isDefault,
  children,
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">
            {title}
          </h3>

          <p className="mt-1 text-sm text-muted">
            {description}
          </p>
        </div>

        {onReset && (
          <button
            type="button"
            className={buttonClass}
            disabled={isDefault}
            onClick={onReset}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset
          </button>
        )}
      </div>

      {children}
    </section>
  );
}

function OptionCard({
  name,
  value,
  selected,
  onChange,
  children,
}) {
  return (
    <label className="block cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
        className="peer sr-only"
      />

      <div
        className={`
          h-full rounded-xl border-2 p-3
          peer-focus-visible:outline-2
          peer-focus-visible:outline-offset-2
          peer-focus-visible:outline-accent
          ${
            selected
              ? "border-accent bg-surface-active"
              : "border-border bg-surface hover:bg-surface-hover"
          }
        `}
      >
        {children}
      </div>
    </label>
  );
}

function ThemePreview({ id, accent }) {
  if (id === "system") {
    return (
      <div
        aria-hidden="true"
        className="flex h-20 overflow-hidden rounded-lg"
      >
        <div className="flex flex-1 items-center justify-center bg-slate-100 text-slate-900">
          Light
        </div>

        <div className="flex flex-1 items-center justify-center bg-gray-950 text-white">
          Dark
        </div>
      </div>
    );
  }

  const colors = THEMES[id].colors;

  return (
    <div
      aria-hidden="true"
      className="space-y-2 rounded-lg p-3"
      style={{ backgroundColor: colors.background }}
    >
      <div
        className="h-5 w-3/4 rounded-md"
        style={{ backgroundColor: colors["bubble-incoming"] }}
      />

      <div
        className="ml-auto h-5 w-2/3 rounded-md"
        style={{ backgroundColor: accent }}
      />
    </div>
  );
}

function MessagePreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-surface p-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <UserRound size={19} />
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">
            Example conversation
          </p>

          <p className="text-xs text-muted">
            Online
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <p className="text-center text-xs text-muted">
          Today
        </p>

        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-message bg-bubble-incoming px-3 py-2 text-foreground">
            <p className="text-message leading-relaxed">
              How do the new appearance settings look?
            </p>

            <p className="mt-1 text-right text-[10px] text-muted">
              10:30 AM
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-message bg-bubble-outgoing px-3 py-2 text-bubble-outgoing-foreground">
            <p className="text-message leading-relaxed">
              Much better! I can customise my messages now.
            </p>

            <div className="mt-1 flex items-center justify-end gap-1 text-[10px]">
              10:31 AM
              <CheckCheck size={13} />
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="flex items-center gap-2 border-t border-border bg-surface p-3"
      >
        <Paperclip size={18} className="text-muted" />

        <div className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-muted">
          Type a message...
        </div>

        <div className="rounded-lg bg-accent p-2 text-accent-foreground">
          <Send size={18} />
        </div>
      </div>
    </div>
  );
}

export default function AppearanceSettings() {
  const id = useId();

  const {
    theme,
    accent,
    messageFontSize,
    bubbleShape,
    hasHydrated,
    updateAppearance,
    reset,
  } = useAppearanceStore(
    useShallow((state) => ({
      theme: state.theme,
      accent: state.accent,
      messageFontSize: state.messageFontSize,
      bubbleShape: state.bubbleShape,
      hasHydrated: state.hasHydrated,
      updateAppearance: state.updateAppearance,
      reset: state.reset,
    }))
  );

  const selectedAccent = ACCENT_COLORS[accent];

  const isDefault = isDefaultAppearance({
    theme,
    accent,
    messageFontSize,
    bubbleShape,
  });

  function resetPreference(key) {
    updateAppearance({
      [key]: DEFAULT_APPEARANCE[key],
    });
  }

  if (!hasHydrated) {
    return (
      <p role="status" className="p-4 text-sm text-muted">
        Loading appearance preferences...
      </p>
    );
  }

  return (
    <section className="min-w-0 space-y-6 rounded-xl border border-border bg-surface p-4 sm:p-5">

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Palette size={22} className="mt-1 text-subtle" />

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Appearance
            </h2>

            <p className="text-sm text-muted">
              Personalise your Messenger experience.
            </p>
          </div>
        </div>

        <button
          type="button"
          className={buttonClass}
          disabled={isDefault}
          onClick={reset}
        >
          <RotateCcw size={15} />
          Reset all
        </button>
      </header>

      <SettingsGroup
        title="Theme"
        description="Choose your application colour scheme."
        isDefault={theme === DEFAULT_APPEARANCE.theme}
        onReset={() => resetPreference("theme")}
      >
        <fieldset className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <legend className="sr-only">Application theme</legend>

          {themeOptions.map(([key, option]) => (
            <OptionCard
              key={key}
              name={`${id}-theme`}
              value={key}
              selected={theme === key}
              onChange={(value) =>
                updateAppearance({ theme: value })
              }
            >
              <ThemePreview
                id={key}
                accent={selectedAccent.color}
              />

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {option.label}
                </span>

                {theme === key && (
                  <Check size={16} className="text-foreground" />
                )}
              </div>

              <p className="mt-1 text-xs text-muted">
                {option.description}
              </p>
            </OptionCard>
          ))}
        </fieldset>
      </SettingsGroup>

      <hr className="border-border" />

      <SettingsGroup
        title="Accent colour"
        description="Customise buttons and outgoing messages."
        isDefault={accent === DEFAULT_APPEARANCE.accent}
        onReset={() => resetPreference("accent")}
      >
        <fieldset className="grid grid-cols-4 gap-2">
          <legend className="sr-only">Accent colour</legend>

          {Object.entries(ACCENT_COLORS).map(([key, option]) => (
            <OptionCard
              key={key}
              name={`${id}-accent`}
              value={key}
              selected={accent === key}
              onChange={(value) =>
                updateAppearance({ accent: value })
              }
            >
              <div
                aria-hidden="true"
                className="mx-auto flex size-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: option.color,
                  color: option.foreground,
                }}
              >
                {accent === key && <Check size={20} />}
              </div>

              <p className="mt-2 text-center text-xs text-foreground">
                {option.label}
              </p>
            </OptionCard>
          ))}
        </fieldset>
      </SettingsGroup>

      <hr className="border-border" />

      <SettingsGroup
        title="Message font size"
        description="Adjust the size of conversation text."
        isDefault={
          messageFontSize === DEFAULT_APPEARANCE.messageFontSize
        }
        onReset={() => resetPreference("messageFontSize")}
      >
        <div className="flex items-center justify-between">
          <label
            htmlFor={`${id}-font`}
            className="text-sm text-muted"
          >
            Text size
          </label>

          <span className="font-mono text-sm text-foreground">
            {messageFontSize}px
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Decrease message font size"
            className={buttonClass}
            disabled={messageFontSize <= MESSAGE_FONT_SIZE.MIN}
            onClick={() =>
              updateAppearance({
                messageFontSize: messageFontSize - 1,
              })
            }
          >
            <Minus size={17} />
          </button>

          <input
            id={`${id}-font`}
            type="range"
            min={MESSAGE_FONT_SIZE.MIN}
            max={MESSAGE_FONT_SIZE.MAX}
            step={MESSAGE_FONT_SIZE.STEP}
            value={messageFontSize}
            aria-valuetext={`${messageFontSize} pixels`}
            onChange={(event) =>
              updateAppearance({
                messageFontSize: Number(event.target.value),
              })
            }
            className="min-w-0 flex-1 accent-accent"
          />

          <button
            type="button"
            aria-label="Increase message font size"
            className={buttonClass}
            disabled={messageFontSize >= MESSAGE_FONT_SIZE.MAX}
            onClick={() =>
              updateAppearance({
                messageFontSize: messageFontSize + 1,
              })
            }
          >
            <Plus size={17} />
          </button>
        </div>
      </SettingsGroup>

      <hr className="border-border" />

      <SettingsGroup
        title="Bubble shape"
        description="Choose the corner style of your messages."
        isDefault={
          bubbleShape === DEFAULT_APPEARANCE.bubbleShape
        }
        onReset={() => resetPreference("bubbleShape")}
      >
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">Message bubble shape</legend>

          {Object.entries(BUBBLE_SHAPES).map(([key, option]) => (
            <OptionCard
              key={key}
              name={`${id}-bubble`}
              value={key}
              selected={bubbleShape === key}
              onChange={(value) =>
                updateAppearance({ bubbleShape: value })
              }
            >
              <div
                aria-hidden="true"
                className="bg-accent px-3 py-2 text-center text-sm text-accent-foreground"
                style={{ borderRadius: option.radius }}
              >
                Hello there!
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-foreground">
                  {option.label}
                </span>

                {bubbleShape === key && <Check size={16} />}
              </div>
            </OptionCard>
          ))}
        </fieldset>
      </SettingsGroup>

      <hr className="border-border" />

      <section className="space-y-3">
        <h3 className="font-semibold text-foreground">
          Live preview
        </h3>

        <MessagePreview />
      </section>

      <p className="text-xs text-muted">
        Appearance preferences are saved locally on this device.
      </p>
    </section>
  );
}