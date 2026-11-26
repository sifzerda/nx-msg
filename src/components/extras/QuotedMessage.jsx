// src/components/extras/QuotedMessage.jsx

"use client";

import { memo } from "react";

function QuotedMessage({
  message,
  senderName,
  isOwn,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!message || !onClick}
      className={`mb-2 block w-full min-w-0 rounded-md border-l-2 px-3 py-2 text-left transition-colors ${isOwn
          ? "border-blue-300 bg-black/20 hover:bg-black/30"
          : "border-blue-500 bg-gray-950/60 hover:bg-gray-950"
        }`}
    >
      <p
        className={`truncate text-xs font-semibold ${isOwn
            ? "text-blue-200"
            : "text-blue-400"
          }`}
      >
        {message
          ? message.content ||
          (message.attachment_type === "image"
            ? "Photo"
            : "Attachment")
          : "Message unavailable"}
      </p>

      <p
        className={`mt-1 line-clamp-2 wrap-break-word text-xs ${isOwn
            ? "text-blue-100"
            : "text-gray-400"
          }`}
      >
        {message?.content ||
          "Message unavailable"}
      </p>
    </button>
  );
}

export default memo(QuotedMessage);
