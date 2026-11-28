// src/hooks/usePaginatedSearch.js

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const EMPTY_ITEMS = Object.freeze([]);

const EMPTY_STATE = Object.freeze({
  items: EMPTY_ITEMS,
  cursor: null,
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
});

function createState(key, loading = false) {
  return {
    ...EMPTY_STATE,
    key,
    loading,
  };
}

/* -------------------- RESULT MERGING -------------------- */

function mergeItems(existing, incoming) {
  const ids = new Set(
    existing.map((item) => item.id)
  );

  let merged = existing;

  for (const item of incoming) {
    if (!item?.id || ids.has(item.id)) {
      continue;
    }

    ids.add(item.id);

    if (merged === existing) {
      merged = [...existing];
    }

    merged.push(item);
  }

  return merged;
}

function getErrorMessage(error, fallback) {
  return error?.message || fallback;
}

/* -------------------- SEARCH HOOK -------------------- */

export default function usePaginatedSearch({
  query,
  scope = null,
  enabled = true,
  delay = 350,
  initialCursor = null,
  fetchPage,
  searchError = "Unable to load results.",
  paginationError = "Unable to load more results.",
}) {
  const [attempt, setAttempt] = useState(0);

  const key = JSON.stringify([
    scope,
    query,
    enabled,
    attempt,
  ]);

  const [state, setState] = useState(() =>
    createState(key, enabled)
  );

  const sessionRef = useRef(null);

  // Never expose results from a previous search
  // while waiting for the effect to initialise.
  const current =
    state.key === key
      ? state
      : createState(key, enabled);

  /* -------------------- INITIAL REQUEST -------------------- */

  useEffect(() => {
    const session = {
      key,
      active: true,
      request: null,
      ready: false,
      cursor: initialCursor,
      hasMore: false,
    };

    sessionRef.current = session;

    let timer = null;

    function isCurrent(controller) {
      return (
        session.active &&
        sessionRef.current === session &&
        !controller.signal.aborted
      );
    }

    async function loadInitialPage() {
      if (!session.active) return;

      const controller = new AbortController();

      session.request = controller;

      try {
        const page = await fetchPage({
          query,
          scope,
          cursor: initialCursor,
          signal: controller.signal,
        });

        if (!isCurrent(controller)) return;

        session.cursor = page.cursor;
        session.hasMore = Boolean(page.hasMore);
        session.ready = true;

        setState({
          key,
          items: mergeItems(
            EMPTY_ITEMS,
            page.items
          ),
          cursor: page.cursor,
          hasMore: session.hasMore,
          loading: false,
          loadingMore: false,
          error: null,
        });
      } catch (error) {
        if (!isCurrent(controller)) return;

        setState({
          ...createState(key),
          error: getErrorMessage(
            error,
            searchError
          ),
        });
      } finally {
        if (session.request === controller) {
          session.request = null;
        }
      }
    }

    if (enabled) {
      timer = setTimeout(
        loadInitialPage,
        Math.max(0, delay)
      );
    }

    return () => {
      session.active = false;

      clearTimeout(timer);

      session.request?.abort();

      if (sessionRef.current === session) {
        sessionRef.current = null;
      }
    };
  }, [
    key,
    query,
    scope,
    enabled,
    delay,
    initialCursor,
    fetchPage,
    searchError,
  ]);

  /* -------------------- PAGINATION -------------------- */

  const loadMore = useCallback(async () => {
    const session = sessionRef.current;

    if (
      !enabled ||
      !session?.active ||
      session.key !== key ||
      !session.ready ||
      !session.hasMore ||
      session.request
    ) {
      return;
    }

    const controller = new AbortController();

    session.request = controller;

    function isCurrent() {
      return (
        session.active &&
        sessionRef.current === session &&
        !controller.signal.aborted
      );
    }

    setState((previous) => {
      if (previous.key !== key) {
        return previous;
      }

      return {
        ...previous,
        loadingMore: true,
        error: null,
      };
    });

    try {
      const page = await fetchPage({
        query,
        scope,
        cursor: session.cursor,
        signal: controller.signal,
      });

      if (!isCurrent()) return;

      session.cursor = page.cursor;
      session.hasMore = Boolean(page.hasMore);

      setState((previous) => {
        if (previous.key !== key) {
          return previous;
        }

        return {
          ...previous,

          items: mergeItems(
            previous.items,
            page.items
          ),

          cursor: page.cursor,
          hasMore: session.hasMore,
          loadingMore: false,
          error: null,
        };
      });
    } catch (error) {
      if (!isCurrent()) return;

      setState((previous) => {
        if (previous.key !== key) {
          return previous;
        }

        return {
          ...previous,
          loadingMore: false,
          error: getErrorMessage(
            error,
            paginationError
          ),
        };
      });
    } finally {
      if (session.request === controller) {
        session.request = null;
      }
    }
  }, [
    key,
    enabled,
    query,
    scope,
    fetchPage,
    paginationError,
  ]);

  /* -------------------- RESET -------------------- */

  const reset = useCallback(() => {
    const session = sessionRef.current;

    if (session) {
      session.active = false;
      session.request?.abort();
      sessionRef.current = null;
    }

    setAttempt((previous) => previous + 1);
  }, []);

  return {
    items: current.items,
    cursor: current.cursor,
    hasMore: current.hasMore,
    loading: current.loading,
    loadingMore: current.loadingMore,
    error: current.error,

    loadMore,
    retry: reset,
    reset,
  };
}