// src/components/MessageReactions.jsx

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
} from "@/constants/messages";

const EMPTY_GROUPS = Object.freeze([]);

/* -------------------- REACTION GROUPING -------------------- */

export function groupReactions(reactions, userId) {
  if (!reactions?.length) return EMPTY_GROUPS;

  const groups = new Map();

  for (const { emoji, user_id } of reactions) {
    let group = groups.get(emoji);

    if (!group) {
      group = {
        emoji,
        count: 0,
        selected: false,
      };

      groups.set(emoji, group);
    }

    group.count += 1;

    if (user_id === userId) {
      group.selected = true;
    }
  }

  return QUICK_REACTIONS
    .map((emoji) => groups.get(emoji))
    .filter(Boolean);
}

/* -------------------- REACTION PICKER -------------------- */

export const ReactionPicker = memo(function ReactionPicker({
  isOwn,
  groups = EMPTY_GROUPS,
  onSelect,
}) {
  const [open, setOpen] = useState(false);

  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key !== "Escape") return;

      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSelect(emoji) {
    setOpen(false);
    buttonRef.current?.focus();
    onSelect?.(emoji);
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
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
            const selected = groups.some(
              (group) =>
                group.emoji === emoji && group.selected
            );

            return (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSelect(emoji)}
                title={REACTION_LABELS[emoji]}
                aria-label={REACTION_LABELS[emoji]}
                aria-pressed={selected}
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-xl transition-transform hover:scale-110 hover:bg-gray-700 ${
                  selected ? "bg-blue-600/30" : ""
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
});

/* -------------------- REACTION BADGES -------------------- */

function MessageReactions({
  groups = EMPTY_GROUPS,
  isOwn,
  onToggle,
}) {
  if (!groups.length) return null;

  const interactive = typeof onToggle === "function";

  return (
    <div
      className={`mt-1 flex flex-wrap gap-1 ${
        isOwn ? "justify-end" : "justify-start"
      }`}
    >
      {groups.map(({ emoji, count, selected }) => (
        <button
          key={emoji}
          type="button"
          disabled={!interactive}
          onClick={() => onToggle?.(emoji)}
          aria-pressed={selected}
          aria-label={`${REACTION_LABELS[emoji]}, ${count} ${
            count === 1 ? "reaction" : "reactions"
          }`}
          title={
            interactive
              ? selected
                ? "Remove your reaction"
                : "Add reaction"
              : REACTION_LABELS[emoji]
          }
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors disabled:cursor-default ${
            selected
              ? "border-blue-500 bg-blue-600/20 text-blue-200"
              : "border-gray-700 bg-gray-800 text-gray-300 enabled:hover:border-gray-500"
          }`}
        >
          <span className="text-sm">{emoji}</span>

          <span className="font-medium tabular-nums">
            {count}
          </span>
        </button>
      ))}
    </div>
  );
}

export default memo(MessageReactions);