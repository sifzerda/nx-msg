// src/components/extras/AttachmentPreview.jsx

"use client";

import {
  memo,
  useEffect,
  useRef,
} from "react";

import {
  Film,
  X,
  LoaderCircle,
} from "lucide-react";

import {
  getFileInfo,
  formatFileSize,
  isImageFile,
} from "@/utils/fileUtils";

/* -------------------- LOCAL IMAGE -------------------- */

function LocalImage({ file }) {
  const imageRef = useRef(null);

  useEffect(() => {
    const image = imageRef.current;

    if (!image || !file) return;

    const url = URL.createObjectURL(file);

    image.src = url;

    return () => {
      image.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <img
      ref={imageRef}
      alt="Selected attachment"
      draggable={false}
      className="h-full w-full object-cover"
    />
  );
}

/* -------------------- PREVIEW -------------------- */

function AttachmentPreview({
  file = null,
  gif = null,
  sending = false,
  onRemove,
}) {
  if (!file && !gif) return null;

  const isGif = Boolean(gif);
  const isImage = !isGif && isImageFile(file);
  const isVisual = isGif || isImage;

  const fileInfo = !isVisual
    ? getFileInfo(file.name)
    : null;

  const FileIcon = fileInfo?.icon;

  const title = isGif
    ? gif.title || "GIF"
    : file.name;

  const status = !sending
    ? "Ready to send"
    : isGif
      ? "Sending GIF..."
      : isImage
        ? "Sending image..."
        : "Uploading file...";

  const removeLabel = isGif
    ? "Remove GIF"
    : "Remove attachment";

  const thumbnailClass = isGif
    ? "h-20 w-28"
    : isImage
      ? "h-20 w-20"
      : "h-14 w-14";

  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-gray-800 bg-gray-900/70 p-3">

      {/* Thumbnail */}

      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-800 ${thumbnailClass}`}
      >
        {isGif ? (
          <img
            src={gif.previewUrl}
            alt={gif.title || "Selected GIF"}
            draggable={false}
            className="h-full w-full object-contain"
          />
        ) : isImage ? (
          <LocalImage file={file} />
        ) : sending ? (
          <LoaderCircle
            size={26}
            className="animate-spin text-blue-400"
          />
        ) : (
          <FileIcon
            size={28}
            className={fileInfo.color}
          />
        )}

        {isVisual && sending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <LoaderCircle
              size={24}
              className="animate-spin text-white"
            />
          </div>
        )}
      </div>

      {/* Information */}

      <div className="min-w-0 flex-1">
        {isGif && (
          <div className="mb-1 flex items-center gap-2 text-blue-400">
            <Film size={15} className="shrink-0" />

            <span className="text-xs font-semibold">
              Selected GIF
            </span>
          </div>
        )}

        <p className="truncate text-sm font-medium text-white">
          {title}
        </p>

        {!isGif && (
          <p className="mt-1 text-xs text-gray-400">
            {fileInfo && `${fileInfo.label} · `}
            {formatFileSize(file.size)}
          </p>
        )}

        <p className="mt-1 text-xs text-gray-500">
          {status}
        </p>

        {isGif && (
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
        )}
      </div>

      {/* Remove */}

      <button
        type="button"
        disabled={sending}
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
      >
        <X size={20} />
      </button>
    </div>
  );
}

export default memo(AttachmentPreview);