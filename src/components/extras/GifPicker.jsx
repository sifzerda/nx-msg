// src/components/extras/GifPicker.jsx

"use client";

import {
  memo,
  useEffect,
  useRef,
} from "react";

import {
  Search,
  X,
  Film,
  LoaderCircle,
  ChevronDown,
  SearchX,
  AlertCircle,
} from "lucide-react";

import useGifSearch from "@/hooks/useGifSearch";

import {
  GIF_CATEGORIES,
  GIF_MAX_QUERY_LENGTH,
} from "@/constants/gifs";

const GifTile = memo(function GifTile({
  gif,
  onSelect,
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(gif)}
      title={gif.title}
      aria-label={`Select ${gif.title}`}
      className="
        group relative aspect-[4/3]
        min-w-0 overflow-hidden
        rounded-lg bg-gray-800
        transition-all
        hover:ring-2 hover:ring-blue-500
        focus-visible:ring-2
        focus-visible:ring-blue-500
      "
    >
      <img
        src={gif.previewUrl}
        alt={gif.title}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="
          h-full w-full object-cover
          transition-transform
          group-hover:scale-105
        "
      />
    </button>
  );
});

function GifPicker({
  onSelect,
  onClose,
}) {
  const searchRef = useRef(null);

  const {
    query,
    setQuery,
    gifs,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    retry,
  } = useGifSearch();

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
    }
  }

  return (
    <section
      aria-label="GIF picker"
      onKeyDown={handleKeyDown}
      className="
        min-w-0 border-t border-gray-800
        bg-gray-900
      "
    >
      {/* Header */}

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Film
            size={18}
            className="text-blue-400"
          />

          <h3 className="text-sm font-semibold text-white">
            GIFs
          </h3>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close GIF picker"
          className="
            rounded-lg p-1.5 text-gray-400
            hover:bg-gray-800 hover:text-white
          "
        >
          <X size={18} />
        </button>
      </div>

      {/* Search */}

      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 rounded-xl bg-gray-800 px-3">
          <Search
            size={17}
            className="shrink-0 text-gray-400"
          />

          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            maxLength={GIF_MAX_QUERY_LENGTH}
            placeholder="Search GIFs..."
            aria-label="Search GIFs"
            className="
              min-w-0 flex-1 bg-transparent
              py-2.5 text-sm text-white
              outline-none
              placeholder:text-gray-500
            "
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              aria-label="Clear GIF search"
              className="text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Categories */}

      <div
        className="
          flex gap-2 overflow-x-auto
          px-3 pb-3
        "
      >
        {GIF_CATEGORIES.map((category) => {
          const value =
            category === "Trending"
              ? ""
              : category;

          const active =
            query.trim().toLowerCase() ===
            value.toLowerCase();

          return (
            <button
              key={category}
              type="button"
              aria-pressed={active}
              onClick={() => setQuery(value)}
              className={[
                "shrink-0 rounded-full px-3 py-1.5",
                "text-xs font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700",
              ].join(" ")}
            >
              {category}
            </button>
          );
        })}
      </div>

      {/* Scrollable results */}

      <div
        className="
          max-h-[28dvh] min-h-24
          overflow-y-auto overscroll-contain
          px-3 pb-3
        "
      >
        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
            <LoaderCircle
              size={20}
              className="animate-spin"
            />

            <span className="text-sm">
              Loading GIFs...
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-5 text-center">
            <AlertCircle
              size={24}
              className="text-red-400"
            />

            <p className="text-sm text-red-400">
              {error}
            </p>

            <button
              type="button"
              onClick={retry}
              className="
                rounded-lg bg-gray-800
                px-4 py-2 text-sm text-white
                hover:bg-gray-700
              "
            >
              Try again
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          gifs.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
              <SearchX size={28} />

              <p className="text-sm">
                No GIFs found
              </p>
            </div>
          )}

        {!loading && gifs.length > 0 && (
          <div
            className="
              grid grid-cols-2 gap-2
              sm:grid-cols-3
              lg:grid-cols-4
            "
          >
            {gifs.map((gif) => (
              <GifTile
                key={gif.id}
                gif={gif}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}

        {!loading && hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="
              mt-3 flex w-full items-center
              justify-center gap-2 rounded-lg
              bg-gray-800 py-2.5 text-sm
              text-gray-300 hover:bg-gray-700
              disabled:opacity-50
            "
          >
            {loadingMore ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            ) : (
              <ChevronDown size={16} />
            )}

            {loadingMore
              ? "Loading..."
              : "Load more"}
          </button>
        )}
      </div>

      {/* GIPHY attribution */}

      <div className="flex justify-end border-t border-gray-800 px-3 py-2">
        <a
          href="https://giphy.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="/powered-by-giphy.png"
            alt="Powered by GIPHY"
            className="h-4 w-auto object-contain"
          />
        </a>
      </div>
    </section>
  );
}

export default memo(GifPicker);