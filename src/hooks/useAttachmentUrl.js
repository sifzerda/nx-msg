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

import {
  getPageVisible,
  scheduleBrowserTask,
} from "@/hooks/useBrowser";

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
    let request = null;
    let entry = null;
    let cancelTask = null;

    function clearTask() {
      cancelTask?.();
      cancelTask = null;
    }

    function scheduleTask(callback, deadline) {
      clearTask();

      if (!active) return;

      cancelTask = scheduleBrowserTask(
        () => {
          cancelTask = null;

          if (active) {
            callback();
          }
        },
        deadline
      );
    }

    function scheduleRenewal() {
      if (!entry) return;

      const deadline = Math.max(
        Date.now() + 1000,
        entry.expiresAt -
          ATTACHMENT_EXPIRY_BUFFER
      );

      scheduleTask(loadUrl, deadline);
    }

    function handleError(error) {
      const message =
        error?.message ||
        "Unable to load attachment";

      // Preserve the existing URL until its
      // known expiry if renewal fails.
      if (
        entry &&
        entry.expiresAt > Date.now()
      ) {
        scheduleTask(() => {
          entry = null;

          setState({
            key,
            url: null,
            error: message,
          });
        }, entry.expiresAt);

        return;
      }

      entry = null;

      setState({
        key,
        url: null,
        error: message,
      });
    }

    function loadUrl() {
      if (!active) return;

      if (request) return request;

      if (!getPageVisible()) {
        scheduleTask(loadUrl, Date.now());
        return;
      }

      request = Promise.resolve()
        .then(async () => {
          if (!active) return;

          if (!getPageVisible()) {
            scheduleTask(loadUrl, Date.now());
            return;
          }

          try {
            const nextEntry =
              await getAttachmentUrl(
                path,
                userId
              );

            if (!active) return;

            entry = nextEntry;

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

            handleError(error);
          }
        })
        .finally(() => {
          request = null;
        });

      return request;
    }

    void loadUrl();

    return () => {
      active = false;
      clearTask();
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