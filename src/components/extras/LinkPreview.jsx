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
  RefreshCw,
  LoaderCircle,
} from "lucide-react";

import useLinkPreview from "@/hooks/useLinkPreview";

import {
  normalizeUrl,
  getUrlHostname,
} from "@/utils/urlUtils";

/* -------------------- THUMBNAIL -------------------- */

const PreviewThumbnail = memo(
  function PreviewThumbnail({ messageId }) {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);

    if (failed) {
      return null;
    }

    const src =
      "/api/link-preview/image?messageId=" +
      encodeURIComponent(messageId);

    return (
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black/25">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoaderCircle
              size={20}
              className="animate-spin text-gray-500 motion-reduce:animate-none"
            />
          </div>
        )}

        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={[
            "h-full w-full object-contain",
            "transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />
      </div>
    );
  }
);

/* -------------------- LOADING -------------------- */

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

/* -------------------- LINK PREVIEW -------------------- */

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

  if (!safeUrl) {
    return null;
  }

  const successful =
    preview?.status === "success";

  const title = successful
    ? preview.title || hostname
    : hostname;

  const description = successful
    ? preview.description
    : null;

  const siteName = successful
    ? preview.siteName || hostname
    : hostname;

  const hasImage =
    successful && Boolean(preview.imageUrl);

  const showSiteName =
    siteName &&
    siteName.toLowerCase() !==
      hostname.toLowerCase();

  return (
    <div
      ref={containerRef}
      className="mt-2 w-full min-w-0 max-w-sm"
    >
      {loading ? (
        <PreviewSkeleton />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-gray-900 text-gray-100">
          {/* Clickable preview card */}

          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block min-w-0 transition-colors hover:bg-white/5"
          >
            {/* Automatic thumbnail */}

            {hasImage && (
              <PreviewThumbnail
                key={`${messageId}:${preview.imageUrl}`}
                messageId={messageId}
              />
            )}

            {/* Metadata */}

            <div className="p-3">
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

                    {showSiteName && (
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
            </div>
          </a>

          {/* Retry failed metadata request */}

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