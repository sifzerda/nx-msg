// src/components/ReactionPicker.jsx

"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
} from "react";

import { SmilePlus } from "lucide-react";

import {
  QUICK_REACTIONS,
  REACTION_LABELS,
} from "@/constants/reactions";

function ReactionPicker({
  isOwn,
  onSelect,
  selectedEmojis = [],
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event) {
      if (
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open]);

  function handleSelect(emoji) {
    setOpen(false);
    onSelect?.(emoji);
  }

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Add reaction"
        aria-expanded={open}
        title="Add reaction"
        className={`rounded-full p-2 transition-colors hover:bg-gray-800 hover:text-blue-400 ${
          open ? "text-blue-400" : "text-gray-500"
        }`}
      >
        <SmilePlus size={18} />
      </button>

      {open && (
        <div
          role="group"
          aria-label="Choose reaction"
          className={`absolute bottom-full z-30 mb-2 grid w-max max-w-[180px] grid-cols-4 gap-1 rounded-2xl border border-gray-700 bg-gray-900 p-2 shadow-xl sm:max-w-none sm:grid-cols-7 ${
            isOwn ? "right-0" : "left-0"
          }`}
        >
          {QUICK_REACTIONS.map((emoji) => {
            const selected =
              selectedEmojis.includes(emoji);

            return (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSelect(emoji)}
                title={REACTION_LABELS[emoji]}
                aria-label={REACTION_LABELS[emoji]}
                aria-pressed={selected}
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-xl transition-transform hover:scale-110 hover:bg-gray-700 ${
                  selected
                    ? "bg-blue-600/30"
                    : ""
                }`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(ReactionPicker);
