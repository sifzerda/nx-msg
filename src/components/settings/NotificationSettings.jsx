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
} from "lucide-react";

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
          className={`size-2 rounded-full ${
            enabled && !denied
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
        className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          enabled
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
        <p className="text-sm text-muted">
          Notification sound preferences will be
          available in a future update.
        </p>
      </SettingsSection>
    </div>
  );
}