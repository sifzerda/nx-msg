// src/components/extras/ConversationSearch.jsx

"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import {
  Search,
  X,
  LoaderCircle,
  MessageSquare,
  SearchX,
  ChevronDown,
} from "lucide-react";

import useConversationSearch from "@/hooks/useConversationSearch";
import SearchResult from "./SearchResult";

const EMPTY_MESSAGES = [];

function ConversationSearch({
  conversationId,
  userId,
  messages = EMPTY_MESSAGES,
  onClose,
  onJumpToMessage,
}) {
  const inputRef = useRef(null);

  const {
    query,
    setQuery,
    clearSearch,
    results,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
  } = useConversationSearch(conversationId);

  const loadedIds = useMemo(
    () => new Set(messages.map((message) => message.id)),
    [messages]
  );

  const validQuery = query.trim().length >= 2;

  const showResults =
    validQuery && !loading && results.length > 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [onClose]);

  const handleSelect = useCallback(
    (messageId) => {
      if (loadedIds.has(messageId)) {
        onJumpToMessage?.(messageId);
      }
    },
    [loadedIds, onJumpToMessage]
  );

  const handleClear = useCallback(() => {
    clearSearch();
    inputRef.current?.focus();
  }, [clearSearch]);

  return (
    <section
      aria-label="Search conversation"
      className="flex min-h-0 min-w-0 flex-col border-b border-gray-800 bg-gray-950"
    >
      {/* Search header */}
      <div className="flex shrink-0 items-center gap-2 px-4 pt-4">
        <Search
          size={18}
          className="text-blue-400"
        />

        <h3 className="flex-1 text-sm font-semibold text-white">
          Search conversation
        </h3>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search input */}
      <div className="shrink-0 px-4 pb-3 pt-2">
        <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-3 focus-within:border-blue-500">
          <Search
            size={17}
            className="shrink-0 text-gray-500"
          />

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search messages and files..."
            aria-label="Search messages and files"
            maxLength={200}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-gray-500 [&::-webkit-search-cancel-button]:hidden"
          />

          {loading && (
            <LoaderCircle
              size={17}
              className="shrink-0 animate-spin text-blue-400"
            />
          )}

          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="rounded-md p-1 text-gray-500 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      <div
        aria-busy={loading || loadingMore}
        className="max-h-[35dvh] min-h-0 overflow-y-auto overscroll-contain px-4 pb-4"
      >
        {!validQuery && (
          <div className="flex flex-col items-center gap-2 py-5 text-center">
            <MessageSquare
              size={28}
              className="text-gray-600"
            />

            <p className="text-sm text-gray-400">
              Search your conversation history
            </p>

            <p className="text-xs text-gray-600">
              Search messages, captions and filenames
            </p>

            <p className="text-xs text-gray-600">
              Enter at least two characters
            </p>
          </div>
        )}

        {validQuery && loading && (
          <p
            role="status"
            className="py-4 text-center text-sm text-gray-400"
          >
            Searching conversation...
          </p>
        )}

        {validQuery && error && (
          <p
            role="alert"
            className="rounded-lg bg-red-950/30 p-3 text-sm text-red-400"
          >
            {error}
          </p>
        )}

        {validQuery &&
          !loading &&
          !error &&
          results.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <SearchX
                size={30}
                className="text-gray-600"
              />

              <p className="text-sm text-gray-400">
                No matching messages or files
              </p>
            </div>
          )}

        {showResults && (
          <>
            <p
              aria-live="polite"
              className="mb-3 text-xs text-gray-500"
            >
              {results.length}
              {hasMore ? "+" : ""}{" "}
              {results.length === 1
                ? "result"
                : "results"}
            </p>

            <div className="space-y-2">
              {results.map((message) => (
                <SearchResult
                  key={message.id}
                  message={message}
                  query={query}
                  userId={userId}
                  canJump={loadedIds.has(message.id)}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </>
        )}

        {showResults && hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-900 py-3 text-sm text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-50"
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
              : "Load more results"}
          </button>
        )}
      </div>
    </section>
  );
}

export default memo(ConversationSearch);