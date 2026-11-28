// src/components/extras/MessageAttachment.jsx

"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Download,
  LoaderCircle,
  AlertCircle,
  ImageOff,
  RefreshCw,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
} from "lucide-react";

import {
  getFileInfo,
  formatFileSize,
} from "@/utils/fileUtils";

import {
  downloadAttachment,
} from "@/lib/extras/attachments";

import useAttachmentUrl from "@/hooks/useAttachmentUrl";

/* -------------------- CONSTANTS -------------------- */

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

const VIEWER_BUTTON_CLASS =
  "rounded-lg p-2 text-white transition-colors hover:bg-white/10 disabled:opacity-30";

/* -------------------- FILE ATTACHMENT -------------------- */

function FileAttachment({ path, name, size }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const downloadingRef = useRef(false);

  const {
    icon: FileIcon,
    label,
    color,
  } = getFileInfo(name || "attachment");

  async function handleDownload() {
    if (downloadingRef.current) return;

    downloadingRef.current = true;

    setDownloading(true);
    setError(null);

    try {
      await downloadAttachment(path, name);
    } catch (error) {
      setError(
        error?.message ||
          "Unable to download attachment"
      );
    } finally {
      downloadingRef.current = false;
      setDownloading(false);
    }
  }

  const StatusIcon = downloading
    ? LoaderCircle
    : Download;

  return (
    <div className="mb-2 min-w-0 max-w-full">
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        aria-busy={downloading}
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
            {size != null &&
              ` · ${formatFileSize(size)}`}
          </p>
        </div>

        <StatusIcon
          size={20}
          className={`shrink-0 ${
            downloading ? "animate-spin" : ""
          }`}
        />
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

/* -------------------- IMAGE VIEWER -------------------- */

function ImageViewer({ url, name, onClose }) {
  const [zoom, setZoom] = useState(MIN_ZOOM);

  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    dialog.showModal();

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  function changeZoom(amount) {
    setZoom((current) =>
      Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, current + amount)
      )
    );
  }

  function handleCancel(event) {
    event.preventDefault();
    onClose();
  }

  function handleBackgroundClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Image viewer"
      onCancel={handleCancel}
      onKeyDown={(event) => event.stopPropagation()}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-black/95 p-0 text-white backdrop:bg-black/95"
    >
      <div className="flex h-full min-h-0 flex-col">

        {/* Header */}

        <header className="flex shrink-0 items-center gap-2 border-b border-white/10 p-4">
          <p className="min-w-0 flex-1 truncate text-sm text-gray-300">
            {name || "Image"}
          </p>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open original image"
            aria-label="Open original image"
            className={VIEWER_BUTTON_CLASS}
          >
            <ExternalLink size={20} />
          </a>

          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Close image viewer"
            className={VIEWER_BUTTON_CLASS}
          >
            <X size={24} />
          </button>
        </header>

        {/* Image */}

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div
            onClick={handleBackgroundClick}
            className="mx-auto flex min-h-full items-center justify-center"
            style={{
              width: `${zoom * 100}%`,
              minHeight: `${zoom * 100}%`,
            }}
          >
            <img
              src={url}
              alt={name || "Chat attachment"}
              draggable={false}
              className="max-w-full object-contain"
              style={{
                maxHeight: `${zoom * 75}dvh`,
              }}
            />
          </div>
        </div>

        {/* Zoom controls */}

        <footer className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={() => changeZoom(-ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className={VIEWER_BUTTON_CLASS}
          >
            <ZoomOut size={22} />
          </button>

          <span className="w-16 text-center text-sm tabular-nums">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={() => changeZoom(ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className={VIEWER_BUTTON_CLASS}
          >
            <ZoomIn size={22} />
          </button>

          <button
            type="button"
            onClick={() => setZoom(MIN_ZOOM)}
            aria-label="Reset zoom"
            className={VIEWER_BUTTON_CLASS}
          >
            <RotateCcw size={20} />
          </button>
        </footer>
      </div>
    </dialog>
  );
}

/* -------------------- IMAGE ATTACHMENT -------------------- */

function ImageAttachment({ path, name, userId }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [failedUrl, setFailedUrl] = useState(null);

  const {
    url,
    loading,
    error,
    retry,
  } = useAttachmentUrl(path, userId);

  function handleRetry() {
    setFailedUrl(null);
    setViewerOpen(false);
    retry();
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading image"
        className="mb-2 flex h-40 w-56 max-w-full items-center justify-center rounded-xl bg-black/20"
      >
        <LoaderCircle
          size={24}
          className="animate-spin text-gray-400"
        />
      </div>
    );
  }

  if (error || !url || failedUrl === url) {
    return (
      <div className="mb-2 flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl bg-black/20 p-4">
        <ImageOff size={24} />

        <p className="text-xs">
          Unable to load image
        </p>

        <button
          type="button"
          onClick={handleRetry}
          className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setViewerOpen(true)}
        aria-label={`View ${name || "image"}`}
        className="mb-2 block max-w-full cursor-zoom-in overflow-hidden rounded-xl"
      >
        <img
          src={url}
          alt={name || "Chat image"}
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(url)}
          className="max-h-[320px] max-w-full object-contain"
        />
      </button>

      {viewerOpen && (
        <ImageViewer
          url={url}
          name={name}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}

/* -------------------- ATTACHMENT ROUTER -------------------- */

function MessageAttachment({
  type,
  path,
  name,
  size,
  userId,
}) {
  if (!path) return null;

  if (type === "image") {
    return (
      <ImageAttachment
        key={`${userId}:${path}`}
        path={path}
        name={name}
        userId={userId}
      />
    );
  }

  if (type === "file") {
    return (
      <FileAttachment
        key={`${userId}:${path}`}
        path={path}
        name={name}
        size={size}
      />
    );
  }

  return null;
}

export default memo(MessageAttachment);