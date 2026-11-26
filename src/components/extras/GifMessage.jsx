// src/components/extras/GifMessage.jsx

"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
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

function GifMessage({ gifId }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [gif, setGif] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Load GIFs near the visible message area

  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    if (
      typeof IntersectionObserver ===
      "undefined"
    ) {
      setVisible(true);
      return;
    }

    const observer =
      new IntersectionObserver(
        ([entry]) => {
          setVisible(entry.isIntersecting);
        },
        {
          rootMargin: "150px",
        }
      );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // Respect reduced-motion preferences

  useEffect(() => {
    const media = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    function update() {
      setPlaying(!media.matches);
    }

    update();

    media.addEventListener("change", update);

    return () => {
      media.removeEventListener(
        "change",
        update
      );
    };
  }, []);

  // Retrieve GIF metadata when needed

  const shouldLoad = visible && !gif;

  useEffect(() => {
    if (!shouldLoad) return;

    const controller =
      new AbortController();

    async function loadGif() {
      setLoading(true);
      setError(null);
      setVideoFailed(false);

      try {
        const result = await getGifById(
          gifId,
          controller.signal
        );

        if (controller.signal.aborted) {
          return;
        }

        setGif(result);
        setLoading(false);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          error.message ||
          "Unable to load GIF"
        );

        setLoading(false);
      }
    }

    loadGif();

    return () => controller.abort();
  }, [gifId, shouldLoad, attempt]);

  const useVideo = Boolean(
    gif?.mp4Url && !videoFailed
  );

  // Pause videos outside the visible area

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    if (playing && visible) {
      video.play().catch(() => {
        setPlaying(false);
      });
    } else {
      video.pause();
    }
  }, [playing, visible, useVideo, gif]);

  function retry() {
    setGif(null);
    setError(null);
    setLoading(true);
    setVideoFailed(false);

    setAttempt((current) => current + 1);
  }

  const imageSource =
    playing && visible
      ? gif?.url
      : gif?.stillUrl;

  const canTogglePlayback =
    useVideo || Boolean(gif?.stillUrl);

  return (
    <div
      ref={containerRef}
      className="w-64 max-w-full overflow-hidden rounded-xl bg-black/20"
    >
      {/* Loading placeholder */}

      {loading && !error && (
        <div className="flex aspect-[4/3] items-center justify-center">
          {visible ? (
            <LoaderCircle
              size={24}
              className="animate-spin opacity-60"
            />
          ) : (
            <Film
              size={28}
              className="opacity-40"
            />
          )}
        </div>
      )}

      {/* Error */}

      {error && (
        <div className="flex min-h-28 flex-col items-center justify-center gap-2 p-4 text-center">
          <AlertCircle
            size={24}
            className="opacity-70"
          />

          <p className="text-xs">
            GIF unavailable
          </p>

          <button
            type="button"
            onClick={retry}
            className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-1.5 text-xs hover:bg-black/30"
          >
            <RotateCw size={13} />

            Retry
          </button>
        </div>
      )}

      {/* GIF content */}

      {gif && !error && (
        <>
          <div className="group/gif relative">
            {useVideo ? (
              <video
                ref={videoRef}
                src={gif.mp4Url}
                poster={
                  gif.stillUrl || undefined
                }
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={gif.title}
                onError={() =>
                  setVideoFailed(true)
                }
                className="block max-h-72 w-full object-contain"
              />
            ) : imageSource ? (
              <img
                src={imageSource}
                alt={gif.title || "GIF"}
                loading="lazy"
                decoding="async"
                draggable={false}
                onError={() =>
                  setError(
                    "Unable to display GIF"
                  )
                }
                className="block max-h-72 w-full object-contain"
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center">
                <button
                  type="button"
                  onClick={() =>
                    setPlaying(true)
                  }
                  aria-label="Play GIF"
                  className="rounded-full bg-black/60 p-3"
                >
                  <Play size={24} />
                </button>
              </div>
            )}

            {canTogglePlayback && (
              <button
                type="button"
                onClick={() =>
                  setPlaying(
                    (current) => !current
                  )
                }
                aria-label={
                  playing
                    ? "Pause GIF"
                    : "Play GIF"
                }
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

          {/* GIPHY attribution */}

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
        </>
      )}
    </div>
  );
}

export default memo(GifMessage);