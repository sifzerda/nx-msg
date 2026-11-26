// src/components/extras/SearchAttachmentPreview.jsx

"use client";

import { memo } from "react";
import { getFileInfo, formatFileSize } from "@/utils/fileUtils";

function SearchAttachmentPreview({
  message,
  query,
  HighlightedText,
}) {
  if (!message?.attachment_path) {
    return null;
  }

  const name = message.attachment_name || "Attachment";

  const {
    icon: FileIcon,
    color,
    label,
  } = getFileInfo(name);

  const size = formatFileSize(message.attachment_size);

  return (
    <div className="mt-2 flex min-w-0 items-center gap-3 rounded-lg bg-gray-950/60 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-800">
        <FileIcon
          size={23}
          className={color}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="break-all text-xs font-medium text-gray-200">
          {HighlightedText ? (
            <HighlightedText
              text={name}
              query={query}
            />
          ) : (
            name
          )}
        </p>

        <p className="mt-1 text-[11px] text-gray-500">
          {label}

          {size && ` · ${size}`}
        </p>
      </div>
    </div>
  );
}

export default memo(SearchAttachmentPreview);