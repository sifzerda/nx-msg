// src/components/messages/MessageBubble.jsx

import { Check, CheckCheck } from "lucide-react";

export default function MessageBubble({
  message,
  isOwn,
  isRead = false,
}) {
  const time = new Date(
    message.created_at
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex ${
        isOwn ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isOwn
            ? "bg-blue-600 text-white"
            : "bg-gray-800 text-gray-100"
        }`}
      >
        <p className="whitespace-pre-wrap wrap-break-word text-sm">
          {message.content}
        </p>

        <div className="mt-1 flex items-center justify-end gap-2">
          <span className="text-xs opacity-60">
            {time}
          </span>

          {isOwn && (
            <span
              className={`flex items-center gap-1 text-xs ${
                isRead
                  ? "text-blue-200"
                  : "text-blue-100/70"
              }`}
            >
              {isRead ? (
                <>
                  <CheckCheck size={14} />
                  Read
                </>
              ) : (
                <>
                  <Check size={14} />
                  Unread
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
