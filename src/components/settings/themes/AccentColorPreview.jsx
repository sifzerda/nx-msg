// src/components/settings/themes/AccentColorPreview.jsx

import { memo } from "react";

import {
  Send,
  CheckCheck,
  MessageSquare,
  Users,
  Settings,
  MousePointer2,
} from "lucide-react";

import { getAccent } from "@/theme/accentColors";

/* -------------------- PREVIEW NAVIGATION -------------------- */

const PreviewNavigation = memo(
  function PreviewNavigation({
    accent,
  }) {
    return (
      <div className="flex flex-wrap items-center gap-1">

        {/* Selected navigation item */}

        <div
          className="
            flex items-center gap-2
            rounded-lg px-3 py-2
            text-xs font-medium
          "
          style={{
            backgroundColor: accent.color,
            color: accent.foreground,
          }}
        >
          <MessageSquare size={14} />

          <span>Messages</span>
        </div>

        {/* Unselected navigation items */}

        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted">
          <Users size={14} />

          <span>Contacts</span>
        </div>

        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted">
          <Settings size={14} />

          <span>Settings</span>
        </div>

      </div>
    );
  }
);

/* -------------------- MESSAGE PREVIEW -------------------- */

const PreviewMessage = memo(
  function PreviewMessage({
    accent,
  }) {
    return (
      <div className="flex justify-end">

        <div
          className="max-w-[90%] rounded-xl px-4 py-3"
          style={{
            backgroundColor: accent.color,
            color: accent.foreground,
          }}
        >
          <p className="text-sm">
            This is my new accent colour!
          </p>

          <div className="mt-1 flex items-center justify-end gap-1">

            <span className="text-[10px]">
              10:42 AM
            </span>

            <CheckCheck size={14} />

          </div>

        </div>
      </div>
    );
  }
);

/* -------------------- BUTTON PREVIEW -------------------- */

const PreviewButtons = memo(
  function PreviewButtons({
    accent,
  }) {
    return (
      <div className="grid grid-cols-2 gap-3">

        <div className="space-y-1.5">

          <p className="text-xs text-muted">
            Default state
          </p>

          <div
            className="
              flex items-center justify-center
              gap-2 rounded-lg px-3 py-2.5
              text-center text-xs font-medium
              sm:text-sm
            "
            style={{
              backgroundColor: accent.color,
              color: accent.foreground,
            }}
          >
            <Send
              size={14}
              className="shrink-0"
            />

            Send message
          </div>

        </div>

        <div className="space-y-1.5">

          <p className="text-xs text-muted">
            Hover state
          </p>

          <div
            className="
              flex items-center justify-center
              gap-2 rounded-lg px-3 py-2.5
              text-center text-xs font-medium
              sm:text-sm
            "
            style={{
              backgroundColor: accent.hover,
              color: accent.foreground,
            }}
          >
            <MousePointer2
              size={14}
              className="shrink-0"
            />

            Send message
          </div>

        </div>

      </div>
    );
  }
);

/* -------------------- INPUT PREVIEW -------------------- */

const PreviewInput = memo(
  function PreviewInput({
    accent,
  }) {
    return (
      <div className="space-y-1.5">

        <p className="text-xs text-muted">
          Focused input
        </p>

        <div className="flex items-center gap-3">

          <div
            className="
              flex min-w-0 flex-1 items-center
              rounded-lg border-2 bg-input
              px-3 py-2.5 text-sm text-muted
            "
            style={{
              borderColor: accent.color,
            }}
          >
            <span className="truncate">
              Type a message...
            </span>

            <span
              className="ml-0.5 h-4 w-px shrink-0"
              style={{
                backgroundColor: accent.color,
              }}
            />
          </div>

          <div
            className="
              flex size-10 shrink-0 items-center
              justify-center rounded-lg
            "
            style={{
              backgroundColor: accent.color,
              color: accent.foreground,
            }}
          >
            <Send size={17} />
          </div>

        </div>
      </div>
    );
  }
);

/* -------------------- ACCENT PREVIEW -------------------- */

function AccentColorPreview({
  accentId,
}) {
  const accent = getAccent(accentId);

  return (
    <section className="space-y-3">

      {/* Preview heading */}

      <div className="flex flex-wrap items-center justify-between gap-2">

        <h4 className="text-sm font-semibold text-foreground">
          Accent preview
        </h4>

        <div className="flex items-center gap-2">

          <span
            aria-hidden="true"
            className="size-3 rounded-full"
            style={{
              backgroundColor: accent.color,
            }}
          />

          <span className="text-xs text-muted">
            {accent.label}
          </span>

          <span className="font-mono text-xs uppercase text-muted">
            {accent.color}
          </span>

        </div>

      </div>

      {/* Preview content */}

      <div
        aria-hidden="true"
        className="
          space-y-5 rounded-xl border
          border-border bg-background p-4
        "
      >
        <PreviewMessage accent={accent} />

        <div className="border-t border-border" />

        <PreviewButtons accent={accent} />

        <PreviewInput accent={accent} />

        <div className="border-t border-border" />

        <PreviewNavigation accent={accent} />

      </div>

      <p className="text-xs leading-relaxed text-muted">
        Your accent colour is used for outgoing messages,
        primary buttons, selected navigation items and
        interactive highlights.
      </p>

    </section>
  );
}

export default memo(AccentColorPreview);