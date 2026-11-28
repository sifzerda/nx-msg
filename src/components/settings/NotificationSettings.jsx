// src/components/settings/NotificationSettings.jsx

"use client";

import { useShallow } from "zustand/react/shallow";

import {
  Bell,
  BellOff,
  BellRing,
  LoaderCircle,
  AlertCircle,
  RefreshCw,
  Volume2,
  Info,
  Volume1,
  VolumeX,
  Play,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";

import {
  SOUND_OPTIONS,
  useNotificationSoundStore,
  previewNotificationSound,
} from "@/lib/notificationSounds";
import usePushStore from "@/store/usePushStore";
import SettingsSection from "./SettingsSection";

function enableNotifications() {
  void usePushStore.getState().enable();
}

function disableNotifications() {
  void usePushStore.getState().disable();
}

function refreshNotifications() {
  void usePushStore.getState().refresh();
}

/* -------------------- PUSH CONTROLS -------------------- */

function PushNotificationControls() {
  const {
    supported,
    initialized,
    checking,
    enabled,
    preference,
    loading,
    signingOut,
    error,
    warning,
  } = usePushStore(
    useShallow((state) => ({
      supported: state.supported,
      initialized: state.initialized,
      checking: state.checking,
      enabled: state.enabled,
      preference: state.preference,
      loading: state.loading,
      signingOut: state.signingOut,
      error: state.error,
      warning: state.warning,
    }))
  );

  const busy = checking || loading || signingOut;

  const permission =
    supported && typeof Notification !== "undefined"
      ? Notification.permission
      : null;

  const denied = permission === "denied";

  if (!initialized && !error) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 text-sm text-muted"
      >
        <LoaderCircle
          size={17}
          className="animate-spin"
        />

        Checking notifications...
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="flex items-start gap-2 text-sm text-muted">
        <BellOff size={18} className="shrink-0" />

        <p>
          Push notifications are not supported by
          this browser.
        </p>
      </div>
    );
  }

  const ActionIcon = loading
    ? LoaderCircle
    : enabled
      ? BellOff
      : Bell;

  const actionLabel = loading
    ? "Please wait..."
    : enabled
      ? "Disable notifications"
      : "Enable notifications";

  return (
    <div className="space-y-3">
      <div
        role="status"
        className="flex items-center gap-2 text-xs text-muted"
      >
        <span
          aria-hidden="true"
          className={`size-2 rounded-full ${enabled && !denied
            ? "bg-green-500"
            : "bg-muted"
            }`}
        />

        {checking
          ? "Checking notifications..."
          : enabled && !denied
            ? "Notifications enabled"
            : "Notifications inactive"}
      </div>

      <button
        type="button"
        disabled={busy || (!enabled && denied)}
        onClick={
          enabled
            ? disableNotifications
            : enableNotifications
        }
        className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${enabled
          ? "border-border text-foreground hover:bg-surface-hover"
          : "border-accent bg-accent text-accent-foreground hover:bg-accent-hover"
          }`}
      >
        <ActionIcon
          size={17}
          className={loading ? "animate-spin" : ""}
        />

        {actionLabel}
      </button>

      {!enabled && (preference || error) && (
        <button
          type="button"
          disabled={busy}
          onClick={disableNotifications}
          className="text-xs text-muted underline hover:text-foreground disabled:opacity-50"
        >
          Disable saved notification preference
        </button>
      )}

      {denied && (
        <p className="text-xs leading-relaxed text-amber-500">
          Notifications are blocked by your browser.
          Change the site permissions to enable them.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 text-xs text-red-500"
        >
          <AlertCircle
            size={15}
            className="shrink-0"
          />

          <p>{error}</p>
        </div>
      )}

      {warning && (
        <p
          role="status"
          className="text-xs text-amber-500"
        >
          {warning}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={refreshNotifications}
        className="flex items-center gap-2 text-xs text-muted hover:text-foreground disabled:opacity-50"
      >
        <RefreshCw
          size={14}
          className={checking ? "animate-spin" : ""}
        />

        {error ? "Retry" : "Refresh status"}
      </button>
    </div>
  );
}

/* -------------------- SOUND TOGGLE -------------------- */

function SoundToggle({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 ${disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer"
        }`}
    >
      <div className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>

        {description && (
          <span className="mt-1 block text-xs leading-relaxed text-muted">
            {description}
          </span>
        )}
      </div>

      <span className="relative shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) =>
            onChange(event.target.checked)
          }
          className="peer sr-only"
        />

        <span className="block h-6 w-11 rounded-full bg-muted/40 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />

        <span className="pointer-events-none absolute left-1 top-1 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/* -------------------- SOUND CONTROLS -------------------- */

function NotificationSoundControls() {
  const [previewError, setPreviewError] =
    useState("");

  const {
    hydrated,
    enabled,
    tone,
    volume,
    activeConversation,
    mentionsOnly,
    updatePreferences,
    resetPreferences,
  } = useNotificationSoundStore(
    useShallow((state) => ({
      hydrated: state.hydrated,
      enabled: state.enabled,
      tone: state.tone,
      volume: state.volume,
      activeConversation:
        state.activeConversation,
      mentionsOnly: state.mentionsOnly,
      updatePreferences:
        state.updatePreferences,
      resetPreferences:
        state.resetPreferences,
    }))
  );

  function update(preferences) {
    setPreviewError("");
    updatePreferences(preferences);
  }

  async function handlePreview() {
    setPreviewError("");

    const played =
      await previewNotificationSound();

    if (!played) {
      setPreviewError(
        "Unable to play the sound. Check your browser audio settings."
      );
    }
  }

  function handleReset() {
    setPreviewError("");
    resetPreferences();
  }

  if (!hydrated) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 text-sm text-muted"
      >
        <LoaderCircle
          size={16}
          className="animate-spin"
        />

        Loading sound preferences...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SoundToggle
        title="Message sounds"
        description="Play a sound when receiving new messages."
        checked={enabled}
        onChange={(value) =>
          update({ enabled: value })
        }
      />

      <div className="space-y-5 border-t border-border pt-5">
        {/* Tone selection */}

        <div className="space-y-2">
          <label
            htmlFor="notification-tone"
            className="text-sm font-medium text-foreground"
          >
            Notification tone
          </label>

          <div className="flex flex-wrap gap-2">
            <select
              id="notification-tone"
              value={tone}
              disabled={!enabled}
              onChange={(event) =>
                update({
                  tone: event.target.value,
                })
              }
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent disabled:opacity-50"
            >
              {SOUND_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!enabled || volume === 0}
              onClick={handlePreview}
              className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={15} />

              Preview
            </button>
          </div>
        </div>

        {/* Volume */}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="notification-volume"
              className="text-sm font-medium text-foreground"
            >
              Volume
            </label>

            <span className="text-sm tabular-nums text-muted">
              {volume}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            {volume === 0 ? (
              <VolumeX
                size={18}
                className="shrink-0 text-muted"
              />
            ) : (
              <Volume1
                size={18}
                className="shrink-0 text-muted"
              />
            )}

            <input
              id="notification-volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={volume}
              disabled={!enabled}
              onChange={(event) =>
                update({
                  volume: Number(
                    event.target.value
                  ),
                })
              }
              className="min-w-0 flex-1 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-50"
            />

            <Volume2
              size={18}
              className="shrink-0 text-muted"
            />
          </div>
        </div>

        {/* Playback behaviour */}

        <div className="space-y-5 border-t border-border pt-5">
          <SoundToggle
            title="Sounds in active conversation"
            description="Play sounds even when the conversation is currently open."
            checked={activeConversation}
            disabled={!enabled}
            onChange={(value) =>
              update({
                activeConversation: value,
              })
            }
          />

          <SoundToggle
            title="Group mentions only"
            description="Only play group message sounds when someone mentions you. Private messages are unaffected."
            checked={mentionsOnly}
            disabled={!enabled}
            onChange={(value) =>
              update({
                mentionsOnly: value,
              })
            }
          />
        </div>
      </div>

      {previewError && (
        <p
          role="alert"
          className="text-xs text-amber-500"
        >
          {previewError}
        </p>
      )}

      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-4">
        <Info
          size={18}
          className="shrink-0 text-muted"
        />

        <p className="text-xs leading-relaxed text-muted">
          Sound preferences are saved on this
          device. Custom sounds play while
          Messenger is visible and focused.
          Background notification sounds are
          controlled by your browser and
          operating system.
        </p>
      </div>

      <button
        type="button"
        onClick={handleReset}
        className="flex items-center gap-2 text-xs text-muted transition-colors hover:text-foreground"
      >
        <RotateCcw size={14} />

        Reset sound preferences
      </button>
    </div>
  );
}

/* -------------------- SETTINGS -------------------- */

export default function NotificationSettings() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-foreground">
          Notifications
        </h1>

        <p className="mt-1 text-sm text-muted">
          Manage how you receive notifications.
        </p>
      </header>

      <SettingsSection
        title="Push notifications"
        description="Receive notifications for new messages."
        icon={BellRing}
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">
            Receive notifications when Messenger is
            minimised or closed, provided your browser
            and device support background notifications.
          </p>

          <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface-secondary p-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-foreground">
                Message notifications
              </h3>

              <p className="mt-1 text-xs text-muted">
                Manage your notification preference
                and this device&apos;s subscription.
              </p>
            </div>

            <PushNotificationControls />
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-4">
            <Info
              size={18}
              className="shrink-0 text-muted"
            />

            <p className="text-xs leading-relaxed text-muted">
              Your browser may request permission before
              enabling notifications. If permission has
              been denied, restore it manually in your
              browser settings.
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Notification sounds"
        description="Customise the sounds played when messages arrive."
        icon={Volume2}
      >
        <NotificationSoundControls />
      </SettingsSection>
    </div>
  );
}