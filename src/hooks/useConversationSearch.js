// src/hooks/useConversationSearch.js

"use client";

import {
  useCallback,
  useState,
} from "react";

import {
  searchMessages,
  MIN_SEARCH_LENGTH,
  MAX_SEARCH_LENGTH,
} from "@/lib/messageSearch";

import usePaginatedSearch from "./usePaginatedSearch";

const SEARCH_DELAY = 350;

/* -------------------- PAGE ADAPTER -------------------- */

async function fetchMessagePage({
  query,
  scope,
  cursor,
  signal,
}) {
  const result = await searchMessages({
    conversationId: scope,
    query,
    cursor,
    signal,
  });

  return {
    items: result.results,
    cursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

/* -------------------- CONVERSATION SEARCH -------------------- */

export default function useConversationSearch(
  conversationId
) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim();

  const length = Array.from(
    normalizedQuery
  ).length;

  const enabled =
    Boolean(conversationId) &&
    length >= MIN_SEARCH_LENGTH &&
    length <= MAX_SEARCH_LENGTH;

  const {
    items,
    cursor,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    reset,
  } = usePaginatedSearch({
    query: normalizedQuery,
    scope: conversationId ?? null,
    enabled,
    delay: SEARCH_DELAY,
    initialCursor: null,

    fetchPage: fetchMessagePage,

    searchError: "Unable to search messages.",
    paginationError: "Unable to load more results.",
  });

  const clearSearch = useCallback(() => {
    reset();
    setQuery("");
  }, [reset]);

  return {
    query,
    setQuery,
    clearSearch,

    results: items,
    nextCursor: cursor,

    hasMore,
    loading,
    loadingMore,
    error,

    loadMore,
  };
}