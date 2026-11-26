// src/components/extras/ImageViewer.jsx

"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
} from "lucide-react";

export default function ImageViewer({
  url,
  name,
  onClose,
}) {
  const [zoom, setZoom] = useState(1);

  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;

    closeRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }

      if (event.key === "Tab") {
        const elements =
          dialogRef.current?.querySelectorAll(
            "button:not(:disabled), a[href]"
          );

        if (!elements?.length) return;

        const first = elements[0];
        const last = elements[elements.length - 1];

        if (
          event.shiftKey &&
          document.activeElement === first
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
      true
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
        true
      );

      previousFocus?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
    >
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
          className="rounded-lg p-2 text-white hover:bg-white/10"
        >
          <ExternalLink size={20} />
        </a>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          className="rounded-lg p-2 text-white hover:bg-white/10"
        >
          <X size={24} />
        </button>
      </header>

      <div
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        className="min-h-0 flex-1 overflow-auto p-4"
      >
        <div
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

      <footer className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 p-4">
        <button
          type="button"
          onClick={() =>
            setZoom((value) =>
              Math.max(1, value - 0.25)
            )
          }
          disabled={zoom <= 1}
          aria-label="Zoom out"
          className="rounded-lg p-2 text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ZoomOut size={22} />
        </button>

        <span className="w-16 text-center text-sm tabular-nums text-white">
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          onClick={() =>
            setZoom((value) =>
              Math.min(3, value + 0.25)
            )
          }
          disabled={zoom >= 3}
          aria-label="Zoom in"
          className="rounded-lg p-2 text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ZoomIn size={22} />
        </button>

        <button
          type="button"
          onClick={() => setZoom(1)}
          aria-label="Reset zoom"
          className="rounded-lg p-2 text-white hover:bg-white/10"
        >
          <RotateCcw size={20} />
        </button>
      </footer>
    </div>,
    document.body
  );
}
