// src/hooks/useReplyMessages.js
// This hook resolves quoted messages

"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getMessagesByIds } from "@/lib/messages";

const EMPTY_MAP = new Map();
const MAX_CACHE_SIZE = 500;
const BATCH_SIZE = 100;

/* -------------------- HELPERS -------------------- */

function createMessageMap(messages) {
  return new Map(
    messages.map((message) => [
      message.id,
      message,
    ])
  );
}

function getMissingKey(
  messages,
  messageMap,
  cachedMessages
) {
  const ids = new Set();

  for (const { reply_to_id: id } of messages) {
    if (
      id &&
      !messageMap.has(id) &&
      !cachedMessages.has(id)
    ) {
      ids.add(id);
    }
  }

  return [...ids].sort().join(",");
}

function pruneCache(cache, requiredIds) {
  if (cache.size <= MAX_CACHE_SIZE) return;

  for (const id of cache.keys()) {
    if (!requiredIds.has(id)) {
      cache.delete(id);
    }

    if (cache.size <= MAX_CACHE_SIZE) {
      break;
    }
  }
}

/* -------------------- HOOK -------------------- */

export default function useReplyMessages(
  conversationId,
  messages
) {
  const requestsRef = useRef(new Map());

  const [cached, setCached] = useState({
    conversationId: null,
    messages: EMPTY_MAP,
  });

  const cachedMessages =
    cached.conversationId === conversationId
      ? cached.messages
      : EMPTY_MAP;

  const messageMap = useMemo(
    () => createMessageMap(messages),
    [messages]
  );

  const requiredIds = useMemo(
    () =>
      new Set(
        messages
          .map((message) => message.reply_to_id)
          .filter(Boolean)
      ),
    [messages]
  );

  const missingKey = useMemo(
    () =>
      getMissingKey(
        messages,
        messageMap,
        cachedMessages
      ),
    [messages, messageMap, cachedMessages]
  );

  useEffect(() => {
    if (!conversationId || !missingKey) return;

    let cancelled = false;

    const requests = requestsRef.current;

    const ids = missingKey.split(",");

    const missingIds = ids.filter(
      (id) =>
        !requests.has(`${conversationId}:${id}`)
    );

    /* -------------------- CREATE REQUESTS -------------------- */

    for (
      let offset = 0;
      offset < missingIds.length;
      offset += BATCH_SIZE
    ) {
      const batch = missingIds.slice(
        offset,
        offset + BATCH_SIZE
      );

      const request = Promise.resolve()
        .then(() =>
          getMessagesByIds(
            conversationId,
            batch
          )
        )
        .then((result) => {
          const found = createMessageMap(result);

          return new Map(
            batch.map((id) => [
              id,
              found.get(id) ?? null,
            ])
          );
        })
        .finally(() => {
          for (const id of batch) {
            const key = `${conversationId}:${id}`;

            if (requests.get(key) === request) {
              requests.delete(key);
            }
          }
        });

      for (const id of batch) {
        requests.set(
          `${conversationId}:${id}`,
          request
        );
      }
    }

    /* -------------------- REUSE REQUESTS -------------------- */

    const pending = [
      ...new Set(
        ids
          .map((id) =>
            requests.get(
              `${conversationId}:${id}`
            )
          )
          .filter(Boolean)
      ),
    ];

    async function loadMissingMessages() {
      const results = await Promise.allSettled(
        pending
      );

      if (cancelled) return;

      const successful = [];

      for (const result of results) {
        if (result.status === "fulfilled") {
          successful.push(result.value);
        } else {
          console.error(
            "Failed to load quoted messages:",
            result.reason
          );
        }
      }

      if (!successful.length) return;

      setCached((current) => {
        const next = new Map(
          current.conversationId === conversationId
            ? current.messages
            : EMPTY_MAP
        );

        for (const result of successful) {
          for (const [id, message] of result) {
            next.set(id, message);
          }
        }

        pruneCache(next, requiredIds);

        return {
          conversationId,
          messages: next,
        };
      });
    }

    void loadMissingMessages();

    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    missingKey,
    requiredIds,
  ]);

  /* -------------------- RESOLVED MESSAGES -------------------- */

  return useMemo(
    () =>
      new Map([
        ...cachedMessages,
        ...messageMap,
      ]),
    [cachedMessages, messageMap]
  );
}