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
  ATTACHMENT_EXPIRY_BUFFER,
} from "@/lib/extras/attachments";

export default function useAttachmentUrl(path, userId) {
  const [state, setState] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const key =
    path && userId
      ? `${userId}:${path}:${attempt}`
      : null;

  const current =
    key && state?.key === key
      ? state
      : null;

  useEffect(() => {
    if (!key) return;

    let active = true;
    let timer = null;
    let request = null;
    let expiresAt = 0;

    function clearTimer() {
      clearTimeout(timer);
      timer = null;
    }

    function isVisible() {
      return document.visibilityState === "visible";
    }

    function scheduleRenewal() {
      clearTimer();

      if (!active || !isVisible()) return;

      const delay = Math.max(
        1000,
        expiresAt -
          Date.now() -
          ATTACHMENT_EXPIRY_BUFFER
      );

      timer = setTimeout(() => {
        timer = null;
        void loadUrl();
      }, delay);
    }

    function loadUrl() {
      if (!active) return;

      if (request) return request;

      request = Promise.resolve()
        .then(async () => {
          try {
            const entry = await getAttachmentUrl(
              path,
              userId
            );

            if (!active) return;

            expiresAt = entry.expiresAt;

            setState((previous) => {
              if (
                previous?.key === key &&
                previous.url === entry.url &&
                !previous.error
              ) {
                return previous;
              }

              return {
                key,
                url: entry.url,
                error: null,
              };
            });

            scheduleRenewal();
          } catch (error) {
            if (!active) return;

            expiresAt = 0;

            setState({
              key,
              url: null,
              error:
                error?.message ||
                "Unable to load attachment",
            });
          }
        })
        .finally(() => {
          request = null;
        });

      return request;
    }

    function handleVisibility() {
      if (!active) return;

      if (!isVisible()) {
        clearTimer();
        return;
      }

      if (
        expiresAt <=
        Date.now() + ATTACHMENT_EXPIRY_BUFFER
      ) {
        void loadUrl();
      } else {
        scheduleRenewal();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    void loadUrl();

    return () => {
      active = false;

      clearTimer();

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [key, path, userId]);

  const retry = useCallback(() => {
    if (!path || !userId) return;

    invalidateAttachmentUrl(path, userId);

    setAttempt((current) => current + 1);
  }, [path, userId]);

  return {
    url: current?.url ?? null,
    loading: Boolean(key && !current),
    error: current?.error ?? null,
    retry,
  };
}