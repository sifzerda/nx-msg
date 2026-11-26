// src/hooks/useTypingIndicator.js

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { createTypingChannel } from "@/lib/extras/typing";

const BROADCAST_INTERVAL = 1000;
const INACTIVITY_TIMEOUT = 2000;
const REMOTE_TIMEOUT = 5000;

const EMPTY_USERS = [];

export default function useTypingIndicator(
  conversationId,
  userId
) {
  const channelRef = useRef(null);
  const inactivityRef = useRef(null);
  const lastBroadcastRef = useRef(0);
  const localTypingRef = useRef(false);

  const [typingState, setTypingState] = useState({
    conversationId: null,
    users: [],
  });

  const stopTyping = useCallback(() => {
    clearTimeout(inactivityRef.current);
    inactivityRef.current = null;

    if (localTypingRef.current) {
      channelRef.current?.broadcast(false);
    }

    localTypingRef.current = false;
    lastBroadcastRef.current = 0;
  }, []);

  const notifyTyping = useCallback(
    (value) => {
      if (!value.trim()) {
        stopTyping();
        return;
      }

      const now = Date.now();

      const shouldBroadcast =
        !localTypingRef.current ||
        now - lastBroadcastRef.current >=
          BROADCAST_INTERVAL;

      localTypingRef.current = true;

      if (shouldBroadcast) {
        channelRef.current?.broadcast(true);
        lastBroadcastRef.current = now;
      }

      clearTimeout(inactivityRef.current);

      inactivityRef.current = setTimeout(
        stopTyping,
        INACTIVITY_TIMEOUT
      );
    },
    [stopTyping]
  );

  useEffect(() => {
    if (!conversationId || !userId) return;

    let active = true;
    let connection = null;

    const remoteTimers = new Map();

    setTypingState({
      conversationId,
      users: [],
    });

    function removeUser(id) {
      clearTimeout(remoteTimers.get(id));
      remoteTimers.delete(id);

      if (!active) return;

      setTypingState((current) => {
        if (
          current.conversationId !== conversationId ||
          !current.users.includes(id)
        ) {
          return current;
        }

        return {
          conversationId,
          users: current.users.filter(
            (user) => user !== id
          ),
        };
      });
    }

    function handleTyping(payload) {
      if (!active) return;

      const { userId: senderId, typing } = payload;

      if (
        senderId === userId ||
        typeof senderId !== "string" ||
        typeof typing !== "boolean"
      ) {
        return;
      }

      if (!typing) {
        removeUser(senderId);
        return;
      }

      clearTimeout(remoteTimers.get(senderId));

      remoteTimers.set(
        senderId,
        setTimeout(() => {
          removeUser(senderId);
        }, REMOTE_TIMEOUT)
      );

      setTypingState((current) => {
        const users =
          current.conversationId === conversationId
            ? current.users
            : [];

        if (users.includes(senderId)) {
          return current;
        }

        return {
          conversationId,
          users: [...users, senderId],
        };
      });
    }

    async function connect() {
      try {
        const result = await createTypingChannel({
          conversationId,
          userId,
          onTyping: handleTyping,

          onStatus: (connected) => {
            if (!active || !connected) return;

            if (localTypingRef.current) {
              channelRef.current?.broadcast(true);
            }
          },
        });

        if (!active) {
          result.close();
          return;
        }

        connection = result;
        channelRef.current = result;

        if (localTypingRef.current) {
          result.broadcast(true);
        }
      } catch (error) {
        if (active) {
          console.error(
            "Failed to connect typing channel:",
            error
          );
        }
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        stopTyping();
      }
    }

    void connect();

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      active = false;

      stopTyping();

      connection?.close();

      if (channelRef.current === connection) {
        channelRef.current = null;
      }

      for (const timer of remoteTimers.values()) {
        clearTimeout(timer);
      }

      remoteTimers.clear();

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [conversationId, userId, stopTyping]);

  const typingUsers =
    typingState.conversationId === conversationId
      ? typingState.users
      : EMPTY_USERS;

  return {
    typingUsers,
    notifyTyping,
    stopTyping,
  };
}
