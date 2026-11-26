// src/components/extras/FileAttachment.jsx

"use client";

import { memo, useState, useRef } from "react";
import { Download, LoaderCircle, AlertCircle } from "lucide-react";
import { getFileInfo, formatFileSize } from "@/utils/fileUtils";
import { downloadAttachment } from "@/lib/extras/attachments";

function FileAttachment({ path, name, size }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const downloadingRef = useRef(false);
  const { icon: FileIcon, label, color } = getFileInfo(name);

  async function handleDownload() {
    if (downloadingRef.current) return;

    downloadingRef.current = true;

    setDownloading(true);
    setError(null);

    try {
      await downloadAttachment(path, name);
    } catch (error) {
      setError(error.message || "Unable to download attachment");
    } finally {
      downloadingRef.current = false;
      setDownloading(false);
    }
  }

  return (
    <div className="mb-2 min-w-0 max-w-full">
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        aria-label={`Download ${name || "attachment"}`}
        title="Download attachment"
        className="flex w-full min-w-0 items-center gap-3 rounded-xl bg-black/20 p-3 text-left transition-colors hover:bg-black/30 disabled:cursor-wait"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-950/60">
          <FileIcon
            size={26}
            className={color}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-medium">
            {name || "Attachment"}
          </p>

          <p className="mt-1 text-xs opacity-70">
            {label}

            {size != null && (<> · {formatFileSize(size)}</>)}
          </p>
        </div>

        {downloading ? (
          <LoaderCircle
            size={20}
            className="shrink-0 animate-spin"
          />
        ) : (
          <Download
            size={20}
            className="shrink-0"
          />
        )}
      </button>

      {error && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 text-xs"
        >
          <AlertCircle
            size={14}
            className="shrink-0"
          />

          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default memo(FileAttachment);