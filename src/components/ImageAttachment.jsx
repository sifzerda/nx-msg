// src/components/ImageAttachment.jsx

"use client";

import {
  memo,
  useCallback,
  useState,
} from "react";

import {
  ImageOff,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import useAttachmentUrl from "@/hooks/useAttachmentUrl";

import ImageViewer from "./ImageViewer";

function ImageAttachment({
  path,
  name,
  userId,
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [failedUrl, setFailedUrl] = useState(null);

  const {
    url,
    loading,
    error,
    retry,
  } = useAttachmentUrl(path, userId);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
  }, []);

  const imageError =
    Boolean(url) && failedUrl === url;

  function handleRetry() {
    setFailedUrl(null);
    retry();
  }

  if (loading) {
    return (
      <div className="mb-2 flex h-40 w-56 max-w-full items-center justify-center rounded-xl bg-black/20">
        <LoaderCircle
          size={24}
          className="animate-spin text-gray-400"
        />
      </div>
    );
  }

  if (error || imageError || !url) {
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
          onClose={closeViewer}
        />
      )}
    </>
  );
}

export default memo(ImageAttachment);
