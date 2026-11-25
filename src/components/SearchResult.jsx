// src/components/SearchResult.jsx

"use client";

import { memo } from "react";
import { ArrowUpRight } from "lucide-react";

import HighlightedText from "./HighlightedText";

const dateFormatter =
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function SearchResult({
  message,
  query,
  userId,
  canJump,
  onSelect,
}) {
  const senderName =
    message.sender_id === userId
      ? "You"
      : message.sender_display_name ||
        message.sender_username ||
        "Member";

  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-gray-900 p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-blue-400">
          {senderName}
        </span>

        <time
          dateTime={message.created_at}
          className="text-xs text-gray-500"
        >
          {dateFormatter.format(
            new Date(message.created_at)
          )}
        </time>
      </div>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-200 [overflow-wrap:anywhere]">
        <HighlightedText
          text={message.content}
          query={query}
        />
      </p>

      {canJump ? (
        <button
          type="button"
          onClick={() =>
            onSelect?.(message.id)
          }
          className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-400 transition-colors hover:text-blue-300"
        >
          Go to message
          <ArrowUpRight size={14} />
        </button>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          Older message
        </p>
      )}
    </div>
  );
}

export default memo(SearchResult);
