// src/components/extras/SearchResult.jsx

"use client";

import { memo, useMemo } from "react";

import {
  ArrowUpRight,
  Clock3,
  Film,
} from "lucide-react";

import { getMessagePreview } from "@/utils/messageUtils";

import {
  getFileInfo,
  formatFileSize,
} from "@/utils/fileUtils";

/* -------------------- CONSTANTS -------------------- */

const DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/* -------------------- SEARCH HIGHLIGHTING -------------------- */

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function createHighlightPattern(query = "") {
  const tokens =
    query.trim().match(/-?"[^"]+"|\S+/g) ?? [];

  const terms = [
    ...new Set(
      tokens
        .filter((term) => !term.startsWith("-"))
        .filter((term) => term.toUpperCase() !== "OR")
        .map((term) => term.replace(/^"+|"+$/g, ""))
        .filter((term) => term.length >= 2)
    ),
  ].sort((a, b) => b.length - a.length);

  return terms.length
    ? new RegExp(
        `(${terms.map(escapeRegex).join("|")})`,
        "gi"
      )
    : null;
}

function HighlightedText({ text = "", pattern }) {
  if (!pattern) return text;

  return text.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <mark
        key={index}
        className="rounded-sm bg-yellow-400/25 text-yellow-300"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/* -------------------- MEDIA PREVIEW -------------------- */

function MediaPreview({
  icon: Icon,
  color,
  title,
  description,
  pattern,
  isGif = false,
}) {
  return (
    <span
      className={`mt-2 flex min-w-0 items-center gap-3 rounded-lg p-3 ${
        isGif
          ? "border border-gray-700 bg-gray-800/60"
          : "bg-gray-950/60"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          isGif
            ? "bg-blue-500/10"
            : "bg-gray-800"
        }`}
      >
        <Icon
          size={isGif ? 19 : 23}
          className={color}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block break-all text-xs font-medium text-gray-200">
          <HighlightedText
            text={title}
            pattern={pattern}
          />
        </span>

        <span className="mt-1 block text-[11px] text-gray-500">
          {description}
        </span>
      </span>
    </span>
  );
}

/* -------------------- ATTACHMENT PREVIEW -------------------- */

function AttachmentPreview({ message, pattern }) {
  const name =
    message.attachment_name || "Attachment";

  const {
    icon,
    color,
    label,
  } = getFileInfo(name);

  const size =
    formatFileSize(message.attachment_size);

  return (
    <MediaPreview
      icon={icon}
      color={color}
      title={name}
      description={
        size ? `${label} · ${size}` : label
      }
      pattern={pattern}
    />
  );
}

/* -------------------- SEARCH RESULT -------------------- */

function SearchResult({
  message,
  query,
  userId,
  canJump,
  onSelect,
}) {
  const pattern = useMemo(
    () => createHighlightPattern(query),
    [query]
  );

  const isOwn = message.sender_id === userId;

  const senderName = isOwn
    ? "You"
    : message.sender_display_name ||
      message.sender_username ||
      "Member";

  const date = new Date(message.created_at);

  const timestamp = Number.isNaN(date.getTime())
    ? ""
    : DATE_FORMATTER.format(date);

  const hasAttachment =
    Boolean(message.attachment_path);

  const hasGif = Boolean(message.gif_id);

  const preview = hasAttachment || hasGif
    ? message.content?.trim() || ""
    : getMessagePreview(message);

  const NavigationIcon = canJump
    ? ArrowUpRight
    : Clock3;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(message.id)}
      disabled={!canJump}
      className={`block w-full min-w-0 rounded-xl border border-gray-800 bg-gray-900 p-3 text-left transition-colors ${
        canJump
          ? "cursor-pointer hover:border-blue-500/50 hover:bg-gray-800"
          : "cursor-default"
      }`}
    >
      {/* Sender and timestamp */}

      <span className="mb-2 flex min-w-0 items-center gap-2">
        <span
          className={`min-w-0 flex-1 truncate text-xs font-semibold ${
            isOwn
              ? "text-blue-400"
              : "text-gray-300"
          }`}
        >
          {senderName}
        </span>

        <time
          dateTime={message.created_at}
          className="shrink-0 text-[11px] text-gray-500"
        >
          {timestamp}
        </time>
      </span>

      {/* Message text or caption */}

      {preview && (
        <span className="block line-clamp-4 whitespace-pre-wrap wrap-break-word text-sm text-gray-200 [overflow-wrap:anywhere]">
          <HighlightedText
            text={preview}
            pattern={pattern}
          />
        </span>
      )}

      {/* GIF preview */}

      {hasGif && (
        <MediaPreview
          icon={Film}
          color="text-blue-400"
          title="GIF"
          description="Animated image"
          pattern={pattern}
          isGif
        />
      )}

      {/* Image or file preview */}

      {hasAttachment && (
        <AttachmentPreview
          message={message}
          pattern={pattern}
        />
      )}

      {/* Navigation */}

      <span className="mt-3 flex items-center gap-1.5">
        <NavigationIcon
          size={13}
          className={
            canJump
              ? "text-blue-400"
              : "text-gray-600"
          }
        />

        <span
          className={`text-[11px] ${
            canJump
              ? "text-blue-400"
              : "text-gray-500"
          }`}
        >
          {canJump
            ? "Jump to message"
            : "Older message"}
        </span>
      </span>
    </button>
  );
}

export default memo(SearchResult);