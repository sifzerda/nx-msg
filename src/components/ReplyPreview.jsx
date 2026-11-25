// src/components/ReplyPreview.jsx

"use client";

import { memo } from "react";
import { Reply, X } from "lucide-react";

function ReplyPreview({
  message,
  senderName,
  onCancel,
}) {
  if (!message) return null;

  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-gray-800 bg-gray-900/70 px-4 py-3">
      <Reply
        size={20}
        className="shrink-0 text-blue-400"
      />

      <div className="min-w-0 flex-1 border-l-2 border-blue-500 pl-3">
        <p className="truncate text-xs font-semibold text-blue-400">
          Replying to {senderName || "Member"}
        </p>

        <p className="mt-1 truncate text-sm text-gray-300">
          {message.content ||
            (message.attachment_type === "image"
              ? "Photo"
              : "Attachment")}
        </p>
      </div>

      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        title="Cancel reply"
        className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export default memo(ReplyPreview);
