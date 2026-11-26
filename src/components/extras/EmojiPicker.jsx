// src/components/extras/EmojiPicker.jsx

"use client";

import { memo, useCallback } from "react";

import EmojiPickerLibrary, {
  Theme,
  EmojiStyle,
  SuggestionMode,
} from "emoji-picker-react";

import { Smile, X } from "lucide-react";

function EmojiPicker({
  onSelect,
  onClose,
}) {
  const handleEmojiClick = useCallback(
    (emojiData) => {
      if (emojiData?.emoji) {
        onSelect?.(emojiData.emoji);
      }
    },
    [onSelect]
  );

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();

      onClose?.();
    }
  }

  return (
    <section
      aria-label="Emoji picker"
      onKeyDown={handleKeyDown}
      className="min-w-0 border-t border-gray-800 bg-gray-900"
    >
      {/* Header */}

      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
          <Smile
            size={18}
            className="text-blue-400"
          />

          Emoji picker
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close emoji picker"
          title="Close emoji picker"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <X size={18} />
        </button>
      </header>

      {/* Emoji library */}

      <div className="mx-auto w-full max-w-lg">
        <EmojiPickerLibrary
          onEmojiClick={handleEmojiClick}
          theme={Theme.DARK}
          emojiStyle={EmojiStyle.NATIVE}
          suggestedEmojisMode={SuggestionMode.RECENT}
          width="100%"
          height="min(340px, 40dvh)"
          searchDisabled={false}
          searchPlaceholder="Search emojis..."
          autoFocusSearch={true}
          skinTonesDisabled={false}
          lazyLoadEmojis={true}
          previewConfig={{
            showPreview: false,
          }}
        />
      </div>
    </section>
  );
}

export default memo(EmojiPicker);