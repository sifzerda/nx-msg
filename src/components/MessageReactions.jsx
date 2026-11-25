// src/components/MessageReactions.jsx

"use client";

import { memo, useMemo } from "react";

import {
  QUICK_REACTIONS,
  REACTION_LABELS,
} from "@/constants/reactions";

const EMPTY_REACTIONS = [];

function MessageReactions({
  reactions = EMPTY_REACTIONS,
  userId,
  isOwn,
  onToggle,
}) {
  const groups = useMemo(() => {
    const grouped = new Map();

    for (const reaction of reactions) {
      let group = grouped.get(reaction.emoji);

      if (!group) {
        group = {
          emoji: reaction.emoji,
          count: 0,
          selected: false,
        };

        grouped.set(reaction.emoji, group);
      }

      group.count += 1;

      if (reaction.user_id === userId) {
        group.selected = true;
      }
    }

    return QUICK_REACTIONS
      .map((emoji) => grouped.get(emoji))
      .filter(Boolean);
  }, [reactions, userId]);

  if (!groups.length) return null;

  return (
    <div
      className={`mt-1 flex flex-wrap gap-1 ${
        isOwn ? "justify-end" : "justify-start"
      }`}
    >
      {groups.map((group) => (
        <button
          key={group.emoji}
          type="button"
          onClick={() => onToggle?.(group.emoji)}
          aria-pressed={group.selected}
          aria-label={`${REACTION_LABELS[group.emoji]}, ${group.count} reactions`}
          title={
            group.selected
              ? "Remove your reaction"
              : "Add reaction"
          }
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
            group.selected
              ? "border-blue-500 bg-blue-600/20 text-blue-200"
              : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500"
          }`}
        >
          <span className="text-sm">
            {group.emoji}
          </span>

          <span className="font-medium tabular-nums">
            {group.count}
          </span>
        </button>
      ))}
    </div>
  );
}

export default memo(MessageReactions);
