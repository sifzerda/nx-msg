// src/components/ReplyPreview.jsx

"use client";

import { memo } from "react";
import { Reply, X } from "lucide-react";
import { getMessagePreview } from "@/utils/messageUtils";

function ReplyPreview({
  message,
  senderName,
  onCancel,
}) {
  if (!message) return null;

  const preview = getMessagePreview(message);

  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-gray-800 bg-gray-900/80 px-4 py-3">
      <Reply
        size={20}
        className="shrink-0 text-blue-400"
      />

      <div className="min-w-0 flex-1 border-l-2 border-blue-500 pl-3">
        <p className="truncate text-xs font-semibold text-blue-400">
          Replying to {senderName || "Member"}
        </p>

        <p className="mt-1 truncate text-sm text-gray-300">
          {preview}
        </p>
      </div>

      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export default memo(ReplyPreview);