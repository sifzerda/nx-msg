// src/components/extras/SearchGifPreview.jsx

"use client";

import { memo } from "react";
import { Film } from "lucide-react";

function SearchGifPreview({
  message,
  query,
  HighlightedText,
}) {
  if (!message?.gif_id) return null;

  return (
    <span className="mt-1.5 flex min-w-0 items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
        <Film size={19} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-gray-200">
          {HighlightedText ? (
            <HighlightedText
              text="GIF"
              query={query}
            />
          ) : (
            "GIF"
          )}
        </span>

        <span className="block text-xs text-gray-500">
          Animated image
        </span>
      </span>
    </span>
  );
}

export default memo(SearchGifPreview);