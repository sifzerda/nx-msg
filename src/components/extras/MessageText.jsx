// src/components/extras/MessageText.jsx

"use client";

import { memo, useMemo } from "react";

import { splitMessageText } from "@/utils/urlUtils";

function MessageText({
  content,
  isOwn = false,
  className = "",
}) {
  const parts = useMemo(
    () => splitMessageText(content || ""),
    [content]
  );

  return (
    <p
      className={[
        "whitespace-pre-wrap wrap-break-word",
        "[overflow-wrap:anywhere] text-sm",
        className,
      ].join(" ")}
    >
      {parts.map((part, index) => {
        if (part.type !== "link") {
          return (
            <span key={index}>
              {part.value}
            </span>
          );
        }

        return (
          <a
            key={index}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className={[
              "underline underline-offset-2",
              "transition-colors",
              isOwn
                ? "text-white hover:text-blue-200"
                : "text-blue-400 hover:text-blue-300",
            ].join(" ")}
          >
            {part.value}
          </a>
        );
      })}
    </p>
  );
}

export default memo(MessageText);