// src/components/extras/GifMessage.jsx

"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  Film,
  LoaderCircle,
  AlertCircle,
  RotateCw,
  Play,
  Pause,
} from "lucide-react";

import { getGifById } from "@/lib/extras/gifs";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/* -------------------- BROWSER PREFERENCES -------------------- */

function subscribeMotion(callback) {
  const media = window.matchMedia(MOTION_QUERY);

  media.addEventListener("change", callback);

  return () => {
    media.removeEventListener("change", callback);
  };
}

function getReducedMotion() {
  return window.matchMedia(MOTION_QUERY).matches;
}

function subscribeVisibility(callback) {
  document.addEventListener("visibilitychange", callback);

  return () => {
    document.removeEventListener("visibilitychange", callback);
  };
}

function getPageVisible() {
  return document.visibilityState === "visible";
}

function getServerSnapshot() {
  return false;
}

/* -------------------- SHARED OBSERVERS -------------------- */

const observers = new Map();

function observeElement(element, rootMargin, callback) {
  if (typeof IntersectionObserver === "undefined") {
    callback(true);
    return () => {};
  }

  let entry = observers.get(rootMargin);

  if (!entry) {
    const callbacks = new Map();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const item of entries) {
          callbacks.get(item.target)?.(item.isIntersecting);
        }
      },
      { rootMargin }
    );

    entry = { observer, callbacks };
    observers.set(rootMargin, entry);
  }

  entry.callbacks.set(element, callback);
  entry.observer.observe(element);

  return () => {
    entry.observer.unobserve(element);
    entry.callbacks.delete(element);

    if (!entry.callbacks.size) {
      entry.observer.disconnect();
      observers.delete(rootMargin);
    }
  };
}

/* -------------------- GIF PLACEHOLDERS -------------------- */

function GifPlaceholder({ loading }) {
  return (
    <div className="flex aspect-[4/3] items-center justify-center">
      {loading ? (
        <LoaderCircle
          size={24}
          className="animate-spin opacity-60"
        />
      ) : (
        <Film size={28} className="opacity-40" />
      )}
    </div>
  );
}

function GifError({ onRetry }) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center gap-2 p-4 text-center">
      <AlertCircle size={24} className="opacity-70" />

      <p className="text-xs">GIF unavailable</p>

      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-1.5 text-xs hover:bg-black/30"
      >
        <RotateCw size={13} />
        Retry
      </button>
    </div>
  );
}

/* -------------------- GIF ATTRIBUTION -------------------- */

const GifAttribution = memo(function GifAttribution() {
  return (
    <div className="flex justify-end bg-black/30 px-2 py-1.5">
      <a
        href="https://giphy.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          src="/images/powered-by-giphy.png"
          alt="Powered by GIPHY"
          className="h-3 w-auto object-contain"
        />
      </a>
    </div>
  );
});

/* -------------------- GIF CONTENT -------------------- */

function GifContent({ gif, onError }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  const [visible, setVisible] = useState(false);
  const [playPreference, setPlayPreference] = useState(null);
  const [videoFailed, setVideoFailed] = useState(false);

  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    getReducedMotion,
    getServerSnapshot
  );

  const pageVisible = useSyncExternalStore(
    subscribeVisibility,
    getPageVisible,
    getServerSnapshot
  );

  const playing = playPreference ?? !reducedMotion;

  const shouldPlay =
    playing && visible && pageVisible;

  const useVideo = Boolean(gif.mp4Url && !videoFailed);

  const imageSource = shouldPlay
    ? gif.url || gif.stillUrl
    : gif.stillUrl;

  const canTogglePlayback =
    useVideo || Boolean(gif.url);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    return observeElement(element, "0px", setVisible);
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !useVideo) return;

    let active = true;

    if (shouldPlay) {
      video.play().catch(() => {
        if (active) {
          setPlayPreference(false);
        }
      });
    } else {
      video.pause();
    }

    return () => {
      active = false;
      video.pause();
    };
  }, [shouldPlay, useVideo, gif.mp4Url]);

  function togglePlayback() {
    setPlayPreference(!playing);
  }

  return (
    <>
      <div ref={containerRef} className="group/gif relative">
        {useVideo ? (
          <video
            ref={videoRef}
            src={gif.mp4Url}
            poster={gif.stillUrl || undefined}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={gif.title || "GIF"}
            onError={() => setVideoFailed(true)}
            className="block max-h-72 w-full object-contain"
          />
        ) : imageSource ? (
          <img
            src={imageSource}
            alt={gif.title || "GIF"}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => onError("Unable to display GIF")}
            className="block max-h-72 w-full object-contain"
          />
        ) : (
          <GifPlaceholder loading={false} />
        )}

        {canTogglePlayback && (
          <button
            type="button"
            onClick={togglePlayback}
            aria-label={playing ? "Pause GIF" : "Play GIF"}
            className="absolute bottom-2 right-2 rounded-full bg-black/60 p-2 text-white transition-opacity hover:bg-black/80 sm:opacity-0 sm:group-hover/gif:opacity-100 sm:focus-visible:opacity-100"
          >
            {playing ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
          </button>
        )}
      </div>

      <GifAttribution />
    </>
  );
}

/* -------------------- GIF MESSAGE -------------------- */

function GifSession({ gifId }) {
  const containerRef = useRef(null);

  const [nearViewport, setNearViewport] = useState(false);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const gif = result?.gif ?? null;
  const error = result?.error ?? null;

  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    return observeElement(
      element,
      "150px",
      setNearViewport
    );
  }, []);

  const shouldLoad =
    nearViewport && !gif && !error;

  useEffect(() => {
    if (!shouldLoad) return;

    const controller = new AbortController();

    async function loadGif() {
      try {
        const data = await getGifById(
          gifId,
          controller.signal
        );

        if (controller.signal.aborted) return;

        if (!data) {
          throw new Error("GIF unavailable");
        }

        setResult({
          gif: data,
          error: null,
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        setResult({
          gif: null,
          error: error?.message || "Unable to load GIF",
        });
      }
    }

    void loadGif();

    return () => controller.abort();
  }, [gifId, shouldLoad, attempt]);

  function retry() {
    setResult(null);
    setAttempt((value) => value + 1);
  }

  function handleDisplayError(error) {
    setResult({
      gif: null,
      error,
    });
  }

  return (
    <div
      ref={containerRef}
      className="w-64 max-w-full overflow-hidden rounded-xl bg-black/20"
    >
      {error ? (
        <GifError onRetry={retry} />
      ) : gif ? (
        <GifContent
          gif={gif}
          onError={handleDisplayError}
        />
      ) : (
        <GifPlaceholder loading={nearViewport} />
      )}
    </div>
  );
}

function GifMessage({ gifId }) {
  if (!gifId) return null;

  return <GifSession key={gifId} gifId={gifId} />;
}

export default memo(GifMessage);