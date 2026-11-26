// src/components/extras/AttachmentPreview.jsx

"use client";

import { memo } from "react";
import { X, LoaderCircle } from "lucide-react";
import { getFileInfo, formatFileSize, isImageFile } from "@/utils/fileUtils";
import ImagePreview from "./ImagePreview";

function AttachmentPreview({
  file,
  onRemove,
  uploading,
}) {
  if (!file) return null;

  if (isImageFile(file)) {
    return (
      <ImagePreview
        file={file}
        onRemove={onRemove}
        uploading={uploading}
      />
    );
  }

  const {
    icon: FileIcon,
    color,
    label,
  } = getFileInfo(file.name);

  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-gray-800 bg-gray-900/70 p-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-800">
        {uploading ? (
          <LoaderCircle
            size={26}
            className="animate-spin text-blue-400"
          />
        ) : (
          <FileIcon
            size={28}
            className={color}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {file.name}
        </p>

        <p className="mt-1 text-xs text-gray-400">
          {label}
          {" · "}
          {formatFileSize(file.size)}
        </p>

        <p className="mt-1 text-xs text-gray-500">
          {uploading
            ? "Uploading file..."
            : "Ready to send"}
        </p>
      </div>

      <button
        type="button"
        disabled={uploading}
        onClick={onRemove}
        aria-label="Remove attachment"
        className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
      >
        <X size={20} />
      </button>
    </div>
  );
}

export default memo(AttachmentPreview);