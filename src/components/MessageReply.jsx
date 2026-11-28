// src/components/MessageReply.jsx

"use client";

import { memo } from "react";
import { Reply, X } from "lucide-react";
import { getMessagePreview } from "@/utils/messageUtils";

function ReplyContent({
  title,
  preview,
  composer = false,
  isOwn = false,
}) {
  return (
    <>
      <p
        className={`truncate text-xs font-semibold ${
          isOwn ? "text-blue-200" : "text-blue-400"
        }`}
      >
        {title}
      </p>

      <p
        className={
          composer
            ? "mt-1 truncate text-sm text-gray-300"
            : "mt-1 line-clamp-2 whitespace-pre-wrap text-xs opacity-80 [overflow-wrap:anywhere]"
        }
      >
        {preview}
      </p>
    </>
  );
}

export const ReplyPreview = memo(function ReplyPreview({
  message,
  senderName,
  onCancel,
}) {
  if (!message) return null;

  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-gray-800 bg-gray-900/80 px-4 py-3">
      <Reply size={20} className="shrink-0 text-blue-400" />

      <div className="min-w-0 flex-1 border-l-2 border-blue-500 pl-3">
        <ReplyContent
          title={`Replying to ${senderName || "Member"}`}
          preview={getMessagePreview(message)}
          composer
        />
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
});

export const QuotedMessage = memo(function QuotedMessage({
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
      className={`mb-2 block w-full min-w-0 rounded-lg border-l-2 px-3 py-2 text-left transition-colors ${
        isOwn
          ? "border-blue-300 bg-black/20 hover:bg-black/30"
          : "border-blue-500 bg-gray-950/60 hover:bg-gray-950/80"
      }`}
    >
      <ReplyContent
        title={
          message
            ? senderName || "Member"
            : "Original message"
        }
        preview={getMessagePreview(message)}
        isOwn={isOwn}
      />
    </button>
  );
});