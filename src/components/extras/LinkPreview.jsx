// src/components/extras/LinkPreview.jsx

"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useNearViewport,
  usePageVisible,
} from "@/hooks/useBrowser";
import {
  Globe,
  ExternalLink,
  RefreshCw,
  LoaderCircle,
} from "lucide-react";

import {
  getCachedLinkPreview,
  getLinkPreview,
  getLinkPreviewImage,
  invalidateLinkPreview,
} from "@/lib/extras/linkPreviews";

import {
  normalizeUrl,
  getUrlHostname,
} from "@/utils/urlUtils";

import { isPreviewAllowed } from "@/utils/previewUrlPolicy";

/* -------------------- METADATA HOOK -------------------- */

function useLinkPreview({ messageId, userId }) {
  const { containerRef, visible } = useNearViewport();
  const pageVisible = usePageVisible();

  const [attempt, setAttempt] = useState(0);

  const [state, setState] = useState(() => {
    const cached = getCachedLinkPreview(
      userId,
      messageId
    );

    return {
      preview: cached ?? null,
      resolved: cached !== undefined,
      loading: false,
      error: null,
    };
  });

  useEffect(() => {
    if (
      !visible ||
      !pageVisible ||
      state.resolved ||
      !messageId ||
      !userId
    ) {
      return;
    }

    let active = true;

    async function loadPreview() {
      if (!active) return;

      const cached = getCachedLinkPreview(
        userId,
        messageId
      );

      if (cached !== undefined) {
        setState({
          preview: cached,
          resolved: true,
          loading: false,
          error: null,
        });

        return;
      }

      setState({
        preview: null,
        resolved: false,
        loading: true,
        error: null,
      });

      try {
        const preview = await getLinkPreview(
          userId,
          messageId
        );

        if (!active) return;

        setState({
          preview,
          resolved: true,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!active) return;

        setState({
          preview: null,
          resolved: true,
          loading: false,
          error:
            error?.name === "AbortError"
              ? "Preview request cancelled"
              : error?.message ||
              "Unable to load preview",
        });
      }
    }

    Promise.resolve().then(loadPreview);

    return () => {
      active = false;
    };
  }, [
    visible,
    pageVisible,
    messageId,
    userId,
    attempt,
    state.resolved,
  ]);

  const retry = useCallback(() => {
    invalidateLinkPreview(userId, messageId);

    setState({
      preview: null,
      resolved: false,
      loading: true,
      error: null,
    });

    setAttempt((value) => value + 1);
  }, [userId, messageId]);

  return {
    containerRef,
    preview: state.preview,
    loading: state.loading,
    error: state.error,
    retry,
  };
}

/* -------------------- THUMBNAIL -------------------- */

const PreviewThumbnail = memo(
  function PreviewThumbnail({
    userId,
    messageId,
    imageUrl,
    expiresAt,
  }) {
    const { containerRef, visible } = useNearViewport();
    const pageVisible = usePageVisible();

    const objectUrlRef = useRef(null);

    const [state, setState] = useState({
      src: null,
      failed: false,
    });

    const releaseObjectUrl = useCallback(() => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    }, []);

    useEffect(() => {
      return releaseObjectUrl;
    }, [releaseObjectUrl]);

    useEffect(() => {
      if (
        !visible ||
        !pageVisible ||
        state.src ||
        state.failed
      ) {
        return;
      }

      let active = true;

      getLinkPreviewImage(
        userId,
        messageId,
        imageUrl,
        expiresAt
      )
        .then((blob) => {
          if (!active) return;

          if (!blob) {
            setState({
              src: null,
              failed: true,
            });

            return;
          }

          releaseObjectUrl();

          const src = URL.createObjectURL(blob);

          objectUrlRef.current = src;

          setState({
            src,
            failed: false,
          });
        })
        .catch(() => {
          if (!active) return;

          setState({
            src: null,
            failed: true,
          });
        });

      return () => {
        active = false;
      };
    }, [
      visible,
      pageVisible,
      userId,
      messageId,
      imageUrl,
      expiresAt,
      state.src,
      state.failed,
      releaseObjectUrl,
    ]);

    const handleImageError = useCallback(() => {
      releaseObjectUrl();

      setState({
        src: null,
        failed: true,
      });
    }, [releaseObjectUrl]);

    if (state.failed) return null;

    return (
      <div
        ref={containerRef}
        className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-black/25"
      >
        {state.src ? (
          <img
            src={state.src}
            alt=""
            decoding="async"
            draggable={false}
            onError={handleImageError}
            className="h-full w-full object-contain"
          />
        ) : (
          <LoaderCircle
            size={20}
            aria-hidden="true"
            className="animate-spin text-gray-500 motion-reduce:animate-none"
          />
        )}
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
        aria-hidden="true"
        className="shrink-0 animate-spin opacity-70 motion-reduce:animate-none"
      />

      <span className="text-xs opacity-80">
        Loading link preview...
      </span>
    </div>
  );
}

/* -------------------- PREVIEW CONTENT -------------------- */

function PreviewContent({
  messageId,
  userId,
  safeUrl,
}) {
  const {
    containerRef,
    preview,
    loading,
    error,
    retry,
  } = useLinkPreview({
    messageId,
    userId,
  });

  const hostname = getUrlHostname(safeUrl);

  const successful = preview?.status === "success";

  const title =
    (successful && preview.title) || hostname;

  const description =
    successful ? preview.description : null;

  const siteName =
    (successful && preview.siteName) || hostname;

  const hasImage =
    successful && Boolean(preview.imageUrl);

  const showSiteName =
    siteName &&
    siteName.toLowerCase() !== hostname.toLowerCase();

  return (
    <div
      ref={containerRef}
      className="mt-2 w-full min-w-0 max-w-sm"
    >
      {loading ? (
        <PreviewSkeleton />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-gray-900 text-gray-100">
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block min-w-0 transition-colors hover:bg-white/5"
          >
            {hasImage && (
              <PreviewThumbnail
                key={`${userId}:${messageId}:${preview.imageUrl}:${preview.expiresAt}`}
                userId={userId}
                messageId={messageId}
                imageUrl={preview.imageUrl}
                expiresAt={preview.expiresAt}
              />
            )}

            <div className="p-3">
              <div className="flex items-start gap-2">
                <Globe
                  size={17}
                  aria-hidden="true"
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
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-gray-500"
                />
              </div>
            </div>
          </a>

          {error && (
            <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
              <span
                title={error}
                className="text-[11px] text-gray-400"
              >
                Preview unavailable
              </span>

              <button
                type="button"
                onClick={retry}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
              >
                <RefreshCw
                  size={12}
                  aria-hidden="true"
                />

                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------- PUBLIC COMPONENT -------------------- */

function LinkPreview({
  messageId,
  userId,
  url,
}) {
  const safeUrl = useMemo(() => {
    if (!isPreviewAllowed(url)) {
      return null;
    }

    return normalizeUrl(url);
  }, [url]);

  if (!safeUrl || !messageId || !userId) {
    return null;
  }

  return (
    <PreviewContent
      key={`${userId}:${messageId}:${safeUrl}`}
      userId={userId}
      messageId={messageId}
      safeUrl={safeUrl}
    />
  );
}

export default memo(LinkPreview);