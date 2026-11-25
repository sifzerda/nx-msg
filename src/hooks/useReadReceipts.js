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
    let fallbackTimer = null;

    function updateTimestamp(timestamp) {
      if (!active || !timestamp) return;

      setReceipt((current) => {
        if (
          current?.conversationId === conversationId &&
          Date.parse(current.timestamp) >=
            Date.parse(timestamp)
        ) {
          return current;
        }

        return {
          conversationId,
          timestamp,
        };
      });
    }

    async function refresh() {
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
    }

    function handleReceipt(member) {
      if (
        !active ||
        member.user_id === userId
      ) {
        return;
      }

      updateTimestamp(member.last_read_at);
    }

    function stopFallback() {
      if (fallbackTimer !== null) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    }

    function startFallback() {
      if (fallbackTimer !== null) return;

      fallbackTimer = setInterval(() => {
        if (
          document.visibilityState === "visible"
        ) {
          void refresh();
        }
      }, 15000);
    }

    const unsubscribe = subscribeToReadReceipts(
      conversationId,
      handleReceipt,
      (status) => {
        if (!active) return;

        if (status === "SUBSCRIBED") {
          stopFallback();

          // Load initial state and reconcile
          // updates missed during disconnection.
          void refresh();
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          startFallback();
        }
      }
    );

    function handleVisibility() {
      if (
        document.visibilityState === "visible"
      ) {
        void refresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    // Fallback while the channel connects.
    startFallback();

    return () => {
      active = false;

      stopFallback();
      unsubscribe();

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [conversationId, userId, enabled]);

  if (
    !enabled ||
    receipt?.conversationId !== conversationId
  ) {
    return null;
  }

  return receipt.timestamp;
}
