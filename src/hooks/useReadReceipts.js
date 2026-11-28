// src/hooks/useReadReceipts.js

"use client";

import { useEffect, useState } from "react";

import {
  getRecipientReadAt,
  subscribeToReadReceipts,
} from "@/lib/messages";

export default function useReadReceipts(
  conversationId,
  userId,
  enabled = true
) {
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (!conversationId || !userId || !enabled) {
      return;
    }

    let active = true;
    let connected = false;
    let refreshRequest = null;
    let refreshPending = false;

    /* -------------------- TIMESTAMP -------------------- */

    function updateTimestamp(timestamp) {
      if (!active || !timestamp) return;

      const time = Date.parse(timestamp);

      if (!Number.isFinite(time)) return;

      setReceipt((current) => {
        if (
          current?.conversationId === conversationId &&
          current?.userId === userId &&
          Date.parse(current.timestamp) >= time
        ) {
          return current;
        }

        return {
          conversationId,
          userId,
          timestamp,
        };
      });
    }

    /* -------------------- SYNCHRONIZATION -------------------- */

    function refresh({ force = false } = {}) {
      if (!active) return;

      if (refreshRequest) {
        if (force) {
          refreshPending = true;
        }

        return refreshRequest;
      }

      refreshRequest = Promise.resolve()
        .then(async () => {
          do {
            refreshPending = false;

            if (!active) return;

            try {
              const timestamp =
                await getRecipientReadAt(conversationId);

              updateTimestamp(timestamp);
            } catch (error) {
              if (active) {
                console.error(
                  "Failed to load read receipts:",
                  error
                );
              }
            }
          } while (active && refreshPending);
        })
        .finally(() => {
          refreshRequest = null;
        });

      return refreshRequest;
    }

    /* -------------------- REALTIME -------------------- */

    function handleReceipt(member) {
      if (
        !active ||
        member?.conversation_id !== conversationId ||
        !member.user_id ||
        member.user_id === userId
      ) {
        return;
      }

      updateTimestamp(member.last_read_at);
    }

    function handleStatus(status) {
      if (!active) return;

      if (status === "SUBSCRIBED") {
        connected = true;

        // Reconcile updates that may have occurred
        // before the subscription became ready.
        void refresh({ force: true });

        return;
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        connected = false;
      }
    }

    const unsubscribe = subscribeToReadReceipts(
      conversationId,
      handleReceipt,
      handleStatus
    );

    /* -------------------- BROWSER EVENTS -------------------- */

    function handleVisibility() {
      if (
        active &&
        document.visibilityState === "visible"
      ) {
        void refresh();
      }
    }

    function handleOnline() {
      if (
        active &&
        !connected &&
        document.visibilityState === "visible"
      ) {
        void refresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    window.addEventListener(
      "online",
      handleOnline
    );

    // Load the current receipt without waiting
    // for the Realtime subscription to connect.
    void refresh();

    /* -------------------- CLEANUP -------------------- */

    return () => {
      active = false;
      refreshPending = false;

      unsubscribe();

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      window.removeEventListener(
        "online",
        handleOnline
      );
    };
  }, [conversationId, userId, enabled]);

  if (
    !enabled ||
    !userId ||
    receipt?.conversationId !== conversationId ||
    receipt?.userId !== userId
  ) {
    return null;
  }

  return receipt.timestamp;
}