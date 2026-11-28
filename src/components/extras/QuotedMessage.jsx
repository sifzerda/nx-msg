// src/components/extras/QuotedMessage.jsx

"use client";

import { memo } from "react";
import { getMessagePreview } from "@/utils/messageUtils";

function QuotedMessage({
  message,
  senderName,
  isOwn,
  onClick,
}) {
  const preview = getMessagePreview(message);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!message || !onClick}
      className={[
        "mb-2 block w-full min-w-0 rounded-lg",
        "border-l-2 px-3 py-2 text-left",
        "transition-colors",
        isOwn
          ? "border-blue-300 bg-black/20 hover:bg-black/30"
          : "border-blue-500 bg-gray-950/60 hover:bg-gray-950/80",
      ].join(" ")}
    >
      <p
        className={[
          "truncate text-xs font-semibold",
          isOwn ? "text-blue-200" : "text-blue-400",
        ].join(" ")}
      >
        {message
          ? senderName || "Member"
          : "Original message"}
      </p>

      <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs opacity-80 [overflow-wrap:anywhere]">
        {preview}
      </p>
    </button>
  );
}

export default memo(QuotedMessage);