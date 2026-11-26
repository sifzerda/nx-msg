// src/hooks/useGifSearch.js

"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

import { searchGifs } from "@/lib/extras/gifs";

import {
  GIF_SEARCH_DELAY,
} from "@/constants/gifs";

const INITIAL_STATE = {
  gifs: [],
  nextOffset: 0,
  hasMore: false,
  loading: true,
  loadingMore: false,
  error: null,
};

function mergeGifs(existing, incoming) {
  const ids = new Set(
    existing.map((gif) => gif.id)
  );

  const merged = [...existing];

  for (const gif of incoming) {
    if (ids.has(gif.id)) continue;

    ids.add(gif.id);
    merged.push(gif);
  }

  return merged;
}

export default function useGifSearch() {
  const [query, setQuery] = useState("");

  const [state, setState] =
    useState(INITIAL_STATE);

  const [retryCount, setRetryCount] =
    useState(0);

  const generationRef = useRef(0);
  const controllerRef = useRef(null);
  const loadingMoreRef = useRef(false);

  const cleanQuery = query.trim();

  useEffect(() => {
    const generation = ++generationRef.current;

    controllerRef.current?.abort();

    const controller = new AbortController();

    controllerRef.current = controller;
    loadingMoreRef.current = false;

    setState({
      ...INITIAL_STATE,
      loading: true,
    });

    async function loadGifs() {
      try {
        const result = await searchGifs({
          query: cleanQuery,
          offset: 0,
          signal: controller.signal,
        });

        if (
          controller.signal.aborted ||
          generation !== generationRef.current
        ) {
          return;
        }

        setState({
          ...result,
          loading: false,
          loadingMore: false,
          error: null,
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          generation !== generationRef.current
        ) {
          return;
        }

        setState({
          ...INITIAL_STATE,
          loading: false,
          error:
            error.message ||
            "Unable to load GIFs",
        });
      }
    }

    const timeout = setTimeout(
      loadGifs,
      cleanQuery ? GIF_SEARCH_DELAY : 0
    );

    return () => {
      clearTimeout(timeout);

      controller.abort();
      controllerRef.current?.abort();
    };
  }, [cleanQuery, retryCount]);

  const loadMore = useCallback(async () => {
    if (
      state.loading ||
      loadingMoreRef.current ||
      !state.hasMore
    ) {
      return;
    }

    const generation = generationRef.current;

    const controller = new AbortController();

    controllerRef.current = controller;

    loadingMoreRef.current = true;

    setState((previous) => ({
      ...previous,
      loadingMore: true,
      error: null,
    }));

    try {
      const result = await searchGifs({
        query: cleanQuery,
        offset: state.nextOffset,
        signal: controller.signal,
      });

      if (
        controller.signal.aborted ||
        generation !== generationRef.current
      ) {
        return;
      }

      setState((previous) => ({
        ...previous,

        gifs: mergeGifs(
          previous.gifs,
          result.gifs
        ),

        nextOffset: result.nextOffset,

        hasMore: result.hasMore,

        loadingMore: false,
      }));
    } catch (error) {
      if (
        controller.signal.aborted ||
        generation !== generationRef.current
      ) {
        return;
      }

      setState((previous) => ({
        ...previous,
        loadingMore: false,
        error:
          error.message ||
          "Unable to load more GIFs",
      }));
    } finally {
      if (generation === generationRef.current) {
        loadingMoreRef.current = false;
      }
    }
  }, [
    cleanQuery,
    state.loading,
    state.hasMore,
    state.nextOffset,
  ]);

  const retry = useCallback(() => {
    setRetryCount((previous) => previous + 1);
  }, []);

  return {
    query,
    setQuery,
    ...state,
    loadMore,
    retry,
  };
}