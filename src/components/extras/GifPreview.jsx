// src/components/extras/GifPreview.jsx

"use client";

import { memo } from "react";
import {
  Film,
  X,
  LoaderCircle,
} from "lucide-react";

function GifPreview({
  gif,
  onRemove,
  sending = false,
}) {
  if (!gif) return null;

  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-gray-800 bg-gray-900/80 px-4 py-3">
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-gray-800">
        <img
          src={gif.previewUrl}
          alt={gif.title || "Selected GIF"}
          draggable={false}
          className="h-full w-full object-contain"
        />

        {sending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <LoaderCircle
              size={24}
              className="animate-spin text-white"
            />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Film
            size={15}
            className="shrink-0 text-blue-400"
          />

          <p className="text-xs font-semibold text-blue-400">
            Selected GIF
          </p>
        </div>

        <p className="mt-1 truncate text-sm text-gray-200">
          {gif.title || "GIF"}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          {sending ? "Sending GIF..." : "Ready to send"}
        </p>

        <a
          href="https://giphy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block"
        >
          <img
            src="/images/powered-by-giphy.png"
            alt="Powered by GIPHY"
            className="h-3 w-auto object-contain"
          />
        </a>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={sending}
        aria-label="Remove GIF"
        title="Remove GIF"
        className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export default memo(GifPreview);