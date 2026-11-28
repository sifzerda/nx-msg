// src/hooks/useGifSearch.js

"use client";

import { useState } from "react";

import { searchGifs } from "@/lib/extras/gifs";

import {
  GIF_SEARCH_DELAY,
  GIF_MAX_QUERY_LENGTH,
} from "@/constants/gifs";

import usePaginatedSearch from "./usePaginatedSearch";

/* -------------------- PAGE ADAPTER -------------------- */

async function fetchGifPage({
  query,
  cursor,
  signal,
}) {
  const result = await searchGifs({
    query,
    offset: cursor ?? 0,
    signal,
  });

  return {
    items: result.gifs,
    cursor: result.nextOffset,
    hasMore: result.hasMore,
  };
}

/* -------------------- GIF SEARCH -------------------- */

export default function useGifSearch() {
  const [query, setQuery] = useState("");

  const cleanQuery = query
    .trim()
    .slice(0, GIF_MAX_QUERY_LENGTH);

  const {
    items,
    cursor,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    retry,
  } = usePaginatedSearch({
    query: cleanQuery,
    initialCursor: 0,

    delay: cleanQuery
      ? GIF_SEARCH_DELAY
      : 0,

    fetchPage: fetchGifPage,

    searchError: "Unable to load GIFs",
    paginationError: "Unable to load more GIFs",
  });

  return {
    query,
    setQuery,

    gifs: items,
    nextOffset: cursor ?? 0,

    hasMore,
    loading,
    loadingMore,
    error,

    loadMore,
    retry,
  };
}