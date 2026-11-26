// src/hooks/useAttachmentUrl.js

"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getAttachmentUrl,
  invalidateAttachmentUrl,
} from "@/lib/extras/attachments";

export default function useAttachmentUrl(path, userId) {
  const [state, setState] = useState({
    key: null,
    url: null,
    loading: false,
    error: null,
  });

  const [attempt, setAttempt] = useState(0);

  const key =
    path && userId
      ? `${userId}:${path}`
      : null;

  useEffect(() => {
    if (!key) return;

    let active = true;
    let timer;

    async function loadUrl() {
      try {
        const entry = await getAttachmentUrl(
          path,
          userId
        );

        if (!active) return;

        setState({
          key,
          url: entry.url,
          loading: false,
          error: null,
        });

        timer = setTimeout(
          loadUrl,
          Math.max(
            1000,
            entry.expiresAt - Date.now() - 30000
          )
        );
      } catch (error) {
        if (!active) return;

        setState({
          key,
          url: null,
          loading: false,
          error:
            error.message ||
            "Unable to load image",
        });
      }
    }

    setState({
      key,
      url: null,
      loading: true,
      error: null,
    });

    void loadUrl();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, path, userId, attempt]);

  const retry = useCallback(() => {
    invalidateAttachmentUrl(path, userId);

    setAttempt((current) => current + 1);
  }, [path, userId]);

  return {
    url: state.key === key ? state.url : null,

    loading: Boolean(key) && (
      state.key !== key || state.loading
    ),

    error:
      state.key === key
        ? state.error
        : null,

    retry,
  };
}
