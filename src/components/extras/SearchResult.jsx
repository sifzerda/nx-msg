// src/components/extras/SearchResult.jsx

"use client";

import { memo, useMemo } from "react";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { getMessagePreview } from "@/utils/messageUtils";
import SearchAttachmentPreview from "./SearchAttachmentPreview";
import SearchGifPreview from "./SearchGifPreview";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

const HighlightedText = memo(function HighlightedText({
  text = "",
  query = "",
}) {
  const parts = useMemo(() => {
    const terms = [
      ...new Set(
        query
          .trim()
          .match(/-?"[^"]+"|\S+/g)
          ?.filter((term) => !term.startsWith("-"))
          .filter((term) => term.toUpperCase() !== "OR")
          .map((term) => term.replace(/^"+|"+$/g, ""))
          .filter((term) => term.length >= 2) ?? []
      ),
    ].sort((a, b) => b.length - a.length);

    if (!terms.length) {
      return [
        {
          text,
          highlighted: false,
        },
      ];
    }

    const pattern = new RegExp(
      `(${terms.map(escapeRegex).join("|")})`,
      "gi"
    );

    return text
      .split(pattern)
      .map((part, index) => ({
        text: part,
        highlighted: index % 2 === 1,
      }));
  }, [text, query]);

  return parts.map((part, index) =>
    part.highlighted ? (
      <mark
        key={index}
        className="rounded-sm bg-yellow-400/25 text-yellow-300"
      >
        {part.text}
      </mark>
    ) : (
      <span key={index}>
        {part.text}
      </span>
    )
  );
});

function SearchResult({
  message,
  query,
  userId,
  canJump,
  onSelect,
}) {
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

  const content = message.content?.trim() || "";

  const hasAttachment = Boolean(message.attachment_path);
  const hasGif = Boolean(message.gif_id);
  const hasMedia = hasAttachment || hasGif;

  // Media messages display only their actual caption.
  // Ordinary messages use the standard preview utility.

  const preview = hasMedia
    ? content
    : getMessagePreview(message);

  const showText = Boolean(preview);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(message.id)}
      disabled={!canJump}
      className={[
        "block w-full min-w-0 rounded-xl border",
        "border-gray-800 bg-gray-900 p-3 text-left",
        "transition-colors",
        canJump
          ? "cursor-pointer hover:border-blue-500/50 hover:bg-gray-800"
          : "cursor-default",
      ].join(" ")}
    >
      {/* Sender and timestamp */}

      <span className="mb-2 flex min-w-0 items-center gap-2">
        <span
          className={[
            "min-w-0 flex-1 truncate text-xs font-semibold",
            isOwn
              ? "text-blue-400"
              : "text-gray-300",
          ].join(" ")}
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

      {showText && (
        <span className="block line-clamp-4 whitespace-pre-wrap wrap-break-word text-sm text-gray-200 [overflow-wrap:anywhere]">
          <HighlightedText
            text={preview}
            query={query}
          />
        </span>
      )}

      {/* GIF preview */}

      {hasGif && (
        <SearchGifPreview
          message={message}
          query={query}
          HighlightedText={HighlightedText}
        />
      )}

      {/* Image or file attachment */}

      {hasAttachment && (
        <SearchAttachmentPreview
          message={message}
          query={query}
          HighlightedText={HighlightedText}
        />
      )}

      {/* Navigation */}

      <span className="mt-3 flex items-center gap-1.5">
        {canJump ? (
          <>
            <ArrowUpRight
              size={13}
              className="text-blue-400"
            />

            <span className="text-[11px] text-blue-400">
              Jump to message
            </span>
          </>
        ) : (
          <>
            <Clock3
              size={13}
              className="text-gray-600"
            />

            <span className="text-[11px] text-gray-500">
              Older message
            </span>
          </>
        )}
      </span>
    </button>
  );
}

export default memo(SearchResult);