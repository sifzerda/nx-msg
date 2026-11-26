// src/components/extras/LinkPreview.jsx

"use client";

import {
  memo,
  useMemo,
  useState,
} from "react";

import {
  Globe,
  ExternalLink,
  Image as ImageIcon,
  RefreshCw,
  LoaderCircle,
} from "lucide-react";

import useLinkPreview from "@/hooks/useLinkPreview";

import {
  normalizeUrl,
  getUrlHostname,
} from "@/utils/urlUtils";

function getSafeImageUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function PreviewThumbnail({ imageUrl }) {
  const [requested, setRequested] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return null;
  }

  if (!requested) {
    return (
      <button
        type="button"
        onClick={() => setRequested(true)}
        title="Load external image. This contacts the image provider."
        className={[
          "flex w-full items-center justify-center",
          "gap-2 border-b border-white/10",
          "bg-black/20 px-3 py-4",
          "text-xs text-gray-300",
          "transition-colors hover:bg-black/30",
        ].join(" ")}
      >
        <ImageIcon size={16} />

        Load external image
      </button>
    );
  }

  return (
    <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-black/30">
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-3"
    >
      <LoaderCircle
        size={15}
        className="shrink-0 animate-spin opacity-70 motion-reduce:animate-none"
      />

      <span className="text-xs opacity-80">
        Loading link preview...
      </span>
    </div>
  );
}

function LinkPreview({
  messageId,
  userId,
  url,
}) {
  const safeUrl = useMemo(
    () => normalizeUrl(url),
    [url]
  );

  const {
    containerRef,
    preview,
    loading,
    error,
    retry,
  } = useLinkPreview({
    messageId,
    userId,
    enabled: Boolean(safeUrl),
  });

  const hostname = useMemo(
    () => getUrlHostname(safeUrl || ""),
    [safeUrl]
  );

  const imageUrl = useMemo(
    () => getSafeImageUrl(preview?.imageUrl),
    [preview?.imageUrl]
  );

  if (!safeUrl) {
    return null;
  }

  const successful = preview?.status === "success";

  const title = successful
    ? preview.title || hostname
    : hostname;

  const description = successful
    ? preview.description
    : null;

  const siteName = successful
    ? preview.siteName || hostname
    : hostname;

  return (
    <div
      ref={containerRef}
      className="mt-2 w-full min-w-0 max-w-sm"
    >
      {loading ? (
        <PreviewSkeleton />
      ) : (
        <div
          className={[
            "overflow-hidden rounded-xl",
            "border border-white/10",
            "bg-gray-900 text-gray-100",
          ].join(" ")}
        >
          {/* Optional external thumbnail */}

          {successful && imageUrl && (
            <PreviewThumbnail
              key={imageUrl}
              imageUrl={imageUrl}
            />
          )}

          {/* Website information */}

          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={[
              "block min-w-0 p-3",
              "transition-colors",
              "hover:bg-white/5",
            ].join(" ")}
          >
            <div className="flex items-start gap-2">
              <Globe
                size={17}
                className="mt-0.5 shrink-0 text-gray-400"
              />

              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 wrap-break-word text-sm font-semibold">
                  {title}
                </p>

                {description && (
                  <p className="mt-1 line-clamp-3 wrap-break-word text-xs leading-relaxed text-gray-400">
                    {description}
                  </p>
                )}

                <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-gray-500">
                  <span className="truncate">
                    {hostname}
                  </span>

                  {siteName &&
                    siteName.toLowerCase() !==
                      hostname.toLowerCase() && (
                      <>
                        <span>·</span>

                        <span className="truncate">
                          {siteName}
                        </span>
                      </>
                    )}
                </div>
              </div>

              <ExternalLink
                size={14}
                className="mt-0.5 shrink-0 text-gray-500"
              />
            </div>
          </a>

          {/* Network error retry */}

          {error && (
            <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
              <span className="text-[11px] text-gray-400">
                Preview unavailable
              </span>

              <button
                type="button"
                onClick={retry}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
              >
                <RefreshCw size={12} />

                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(LinkPreview);