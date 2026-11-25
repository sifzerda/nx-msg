// src/components/DateSeparator.jsx

"use client";

import { memo } from "react";
import { formatMessageDate } from "@/utils/messageDates";

function DateSeparator({ date, now }) {
  return (
    <div className="flex select-none items-center gap-3 py-3">
      <div className="h-px flex-1 bg-gray-800" />

      <time className="shrink-0 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-gray-400">
        {formatMessageDate(date, now)}
      </time>

      <div className="h-px flex-1 bg-gray-800" />
    </div>
  );
}

export default memo(DateSeparator);
