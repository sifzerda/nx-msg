// src/components/settings/themes/ThemePreview.jsx

import { memo } from "react";

import {
  Sun,
  Moon,
  Send,
  UserRound,
} from "lucide-react";

import {
  getTheme,
  THEME_MODE,
} from "@/theme/themes";

import { getAccent } from "@/theme/accentColors";

/* -------------------- SYSTEM PREVIEW -------------------- */

const SystemPreview = memo(function SystemPreview() {
  return (
    <div
      aria-hidden="true"
      className="flex h-28 overflow-hidden rounded-lg"
    >
      <div className="flex flex-1 items-center justify-center bg-slate-100">
        <Sun
          size={26}
          className="text-slate-600"
        />
      </div>

      <div className="flex flex-1 items-center justify-center bg-gray-950">
        <Moon
          size={26}
          className="text-gray-200"
        />
      </div>
    </div>
  );
});

/* -------------------- MESSAGE PLACEHOLDER -------------------- */

const MessagePlaceholder = memo(
  function MessagePlaceholder({
    background,
    foreground,
    outgoing = false,
  }) {
    return (
      <div
        className={`flex ${
          outgoing
            ? "justify-end"
            : "justify-start"
        }`}
      >
        <div
          className="space-y-1 rounded-md px-2 py-1.5"
          style={{
            backgroundColor: background,
            width: outgoing ? "65%" : "75%",
          }}
        >
          <div
            className="h-1 w-full rounded-full opacity-70"
            style={{
              backgroundColor: foreground,
            }}
          />

          <div
            className="h-1 w-2/3 rounded-full opacity-40"
            style={{
              backgroundColor: foreground,
            }}
          />
        </div>
      </div>
    );
  }
);

/* -------------------- THEME PREVIEW -------------------- */

function ThemePreview({
  themeId,
  accentId,
}) {
  if (themeId === THEME_MODE.SYSTEM) {
    return <SystemPreview />;
  }

  const theme = getTheme(themeId);
  const accent = getAccent(accentId);

  const { colors } = theme;

  return (
    <div
      aria-hidden="true"
      className="flex h-28 flex-col overflow-hidden rounded-lg"
      style={{
        backgroundColor: colors.background,
        color: colors.foreground,
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Miniature header */}

      <div
        className="flex items-center gap-1.5 px-2 py-1.5"
        style={{
          backgroundColor: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div
          className="flex size-4 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: accent.color,
            color: accent.foreground,
          }}
        >
          <UserRound size={10} />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div
            className="h-1 w-2/3 rounded-full"
            style={{
              backgroundColor: colors.foreground,
            }}
          />

          <div
            className="h-0.5 w-1/3 rounded-full"
            style={{
              backgroundColor: colors.muted,
            }}
          />
        </div>
      </div>

      {/* Miniature conversation */}

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 px-2 py-1">

        <MessagePlaceholder
          background={colors.bubbleIncoming}
          foreground={colors.foreground}
        />

        <MessagePlaceholder
          background={accent.color}
          foreground={accent.foreground}
          outgoing
        />

      </div>

      {/* Miniature composer */}

      <div
        className="flex items-center gap-1.5 px-2 py-1"
        style={{
          backgroundColor: colors.surface,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <div
          className="h-3 flex-1 rounded-sm"
          style={{
            backgroundColor: colors.input,
            border: `1px solid ${colors.border}`,
          }}
        />

        <Send
          size={10}
          style={{
            color: accent.color,
          }}
        />
      </div>
    </div>
  );
}

export default memo(ThemePreview);