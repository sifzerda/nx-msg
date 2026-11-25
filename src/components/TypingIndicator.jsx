// src/components/TypingIndicator.jsx

"use client";

import { memo } from "react";

function getTypingLabel(names) {
  const count = names.length;

  if (count === 0) return "";

  if (count === 1) {
    return `${names[0]} is typing...`;
  }

  if (count === 2) {
    return `${names[0]} and ${names[1]} are typing...`;
  }

  if (count === 3) {
    return `${names[0]}, ${names[1]} and ${names[2]} are typing...`;
  }

  return `${count} people are typing...`;
}

function TypingIndicator({ names = [] }) {
  if (!names.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-w-0 items-center gap-2 px-4 py-2"
    >
      <div
        aria-hidden="true"
        className="flex shrink-0 items-center gap-1 rounded-full bg-gray-800 px-3 py-2"
      >
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 motion-reduce:animate-none"
            style={{
              animationDelay: `${index * 150}ms`,
            }}
          />
        ))}
      </div>

      <span className="truncate text-xs text-gray-400">
        {getTypingLabel(names)}
      </span>
    </div>
  );
}

export default memo(TypingIndicator);
