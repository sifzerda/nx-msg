// src/hooks/useLinkPreview.js

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getCachedLinkPreview,
  getLinkPreview,
  invalidateLinkPreview,
} from "@/lib/linkPreviews";

export default function useLinkPreview({
  messageId,
  userId,
  enabled = true,
}) {
  const containerRef = useRef(null);

  const [visible, setVisible] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const key = `${userId}:${messageId}`;

  const [state, setState] = useState({
    key: null,
    preview: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled || visible) {
      return;
    }

    const element = containerRef.current;

    if (!element) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "150px",
        threshold: 0,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [enabled, visible]);

  useEffect(() => {
    if (!enabled || !visible || !messageId || !userId) {
      return;
    }

    let cancelled = false;

    const cached = getCachedLinkPreview(
      userId,
      messageId
    );

    if (cached !== undefined) {
      setState({
        key,
        preview: cached,
        loading: false,
        error: null,
      });

      return;
    }

    setState({
      key,
      preview: null,
      loading: true,
      error: null,
    });

    getLinkPreview(userId, messageId)
      .then((preview) => {
        if (cancelled) return;

        setState({
          key,
          preview,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;

        setState({
          key,
          preview: null,
          loading: false,
          error:
            error.name === "AbortError"
              ? null
              : error.message || "Unable to load preview",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    visible,
    messageId,
    userId,
    key,
    retryCount,
  ]);

  const retry = useCallback(() => {
    invalidateLinkPreview(userId, messageId);

    setRetryCount((count) => count + 1);
  }, [userId, messageId]);

  const current = state.key === key;

  return {
    containerRef,
    preview: enabled && current ? state.preview : null,
    loading: enabled && current ? state.loading : false,
    error: enabled && current ? state.error : null,
    retry,
  };
}