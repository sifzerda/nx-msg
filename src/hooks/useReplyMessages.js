// src/hooks/useReplyMessages.js
// This hook resolves quoted messages

"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { getMessagesByIds } from "@/lib/messages";

const EMPTY_MAP = new Map();

export default function useReplyMessages(
  conversationId,
  messages
) {
  const [cached, setCached] = useState({
    conversationId: null,
    messages: new Map(),
  });

  const cachedMessages =
    cached.conversationId === conversationId
      ? cached.messages
      : EMPTY_MAP;

  const messageMap = useMemo(() => {
    return new Map(
      messages.map((message) => [
        message.id,
        message,
      ])
    );
  }, [messages]);

  const missingKey = useMemo(() => {
    const ids = new Set();

    for (const message of messages) {
      const id = message.reply_to_id;

      if (
        id &&
        !messageMap.has(id) &&
        !cachedMessages.has(id)
      ) {
        ids.add(id);
      }
    }

    return [...ids].sort().join(",");
  }, [messages, messageMap, cachedMessages]);

  useEffect(() => {
    if (!conversationId || !missingKey) return;

    let cancelled = false;

    async function loadMissingMessages() {
      const ids = missingKey.split(",");

      try {
        const result = await getMessagesByIds(
          conversationId,
          ids
        );

        if (cancelled) return;

        setCached((current) => {
          const next = new Map(
            current.conversationId === conversationId
              ? current.messages
              : EMPTY_MAP
          );

          // Cache unavailable messages too.
          for (const id of ids) {
            next.set(id, null);
          }

          for (const message of result) {
            next.set(message.id, message);
          }

          return {
            conversationId,
            messages: next,
          };
        });
      } catch (error) {
        console.error(
          "Failed to load quoted messages:",
          error
        );
      }
    }

    void loadMissingMessages();

    return () => {
      cancelled = true;
    };
  }, [conversationId, missingKey]);

  return useMemo(() => {
    return new Map([
      ...cachedMessages,
      ...messageMap,
    ]);
  }, [cachedMessages, messageMap]);
}
