// src/hooks/useConversationSearch.js

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { searchMessages } from "@/lib/messageSearch";

const SEARCH_DELAY = 350;
const MIN_QUERY_LENGTH = 2;

const INITIAL_STATE = {
  results: [],
  loading: false,
  loadingMore: false,
  hasMore: false,
  nextCursor: null,
  error: null,
};

export default function useConversationSearch(
  conversationId
) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState(
    INITIAL_STATE
  );

  const requestRef = useRef(null);
  const generationRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const normalizedQuery = query.trim();

  useEffect(() => {
    const generation =
      ++generationRef.current;

    requestRef.current?.abort();
    requestRef.current = null;
    loadingMoreRef.current = false;

    if (
      !conversationId ||
      normalizedQuery.length < MIN_QUERY_LENGTH
    ) {
      setState(INITIAL_STATE);
      return;
    }

    const controller =
      new AbortController();

    requestRef.current = controller;

    setState({
      ...INITIAL_STATE,
      loading: true,
    });

    const timer = setTimeout(async () => {
      try {
        const response = await searchMessages({
          conversationId,
          query: normalizedQuery,
          signal: controller.signal,
        });

        if (
          controller.signal.aborted ||
          generation !== generationRef.current
        ) {
          return;
        }

        setState({
          ...INITIAL_STATE,
          ...response,
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
          error:
            error.message ||
            "Unable to search messages.",
        });
      }
    }, SEARCH_DELAY);

    return () => {
      clearTimeout(timer);

      controller.abort();
      requestRef.current?.abort();

      generationRef.current += 1;
    };
  }, [conversationId, normalizedQuery]);

  const loadMore = useCallback(async () => {
    if (
      !conversationId ||
      state.loading ||
      loadingMoreRef.current ||
      !state.hasMore ||
      !state.nextCursor
    ) {
      return;
    }

    const generation =
      generationRef.current;

    const controller =
      new AbortController();

    requestRef.current = controller;
    loadingMoreRef.current = true;

    setState((current) => ({
      ...current,
      loadingMore: true,
      error: null,
    }));

    try {
      const response = await searchMessages({
        conversationId,
        query: normalizedQuery,
        cursor: state.nextCursor,
        signal: controller.signal,
      });

      if (
        controller.signal.aborted ||
        generation !== generationRef.current
      ) {
        return;
      }

      setState((current) => {
        const existingIds = new Set(
          current.results.map(
            (message) => message.id
          )
        );

        const newResults =
          response.results.filter(
            (message) =>
              !existingIds.has(message.id)
          );

        return {
          ...current,
          results: [
            ...current.results,
            ...newResults,
          ],
          hasMore: response.hasMore,
          nextCursor: response.nextCursor,
          loadingMore: false,
        };
      });
    } catch (error) {
      if (
        controller.signal.aborted ||
        generation !== generationRef.current
      ) {
        return;
      }

      setState((current) => ({
        ...current,
        loadingMore: false,
        error:
          error.message ||
          "Unable to load more results.",
      }));
    } finally {
      if (
        generation === generationRef.current
      ) {
        loadingMoreRef.current = false;
      }
    }
  }, [
    conversationId,
    normalizedQuery,
    state.loading,
    state.hasMore,
    state.nextCursor,
  ]);

  const clearSearch = useCallback(() => {
    generationRef.current += 1;

    requestRef.current?.abort();
    requestRef.current = null;

    loadingMoreRef.current = false;

    setQuery("");
    setState(INITIAL_STATE);
  }, []);

  return {
    query,
    setQuery,
    clearSearch,
    loadMore,
    ...state,
  };
}
