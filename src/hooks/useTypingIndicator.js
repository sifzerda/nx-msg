// src/hooks/useTypingIndicator.js

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { createTypingChannel } from "@/lib/extras/typing";

/* -------------------- CONSTANTS -------------------- */

const BROADCAST_INTERVAL = 1000;
const INACTIVITY_TIMEOUT = 2000;
const REMOTE_TIMEOUT = 5000;

const EMPTY_USERS = Object.freeze([]);

/* -------------------- HOOK -------------------- */

export default function useTypingIndicator(
  conversationId,
  userId,
  { enabled = true } = {}
) {
  const channelRef = useRef(null);
  const inactivityRef = useRef(null);
  const lastBroadcastRef = useRef(0);
  const localTypingRef = useRef(false);

  const [typingState, setTypingState] = useState({
    conversationId: null,
    userId: null,
    users: EMPTY_USERS,
  });

  const canUseTyping = Boolean(
    enabled &&
    conversationId &&
    userId
  );

  /* -------------------- STOP TYPING -------------------- */

  const stopTyping = useCallback(() => {
    clearTimeout(inactivityRef.current);

    inactivityRef.current = null;

    const wasTyping = localTypingRef.current;

    localTypingRef.current = false;
    lastBroadcastRef.current = 0;

    if (wasTyping) {
      channelRef.current?.broadcast(false);
    }
  }, []);

  /* -------------------- NOTIFY TYPING -------------------- */

  const notifyTyping = useCallback(
    (value) => {
      if (!canUseTyping) return;

      if (
        typeof value !== "string" ||
        !value.trim()
      ) {
        stopTyping();
        return;
      }

      const now = Date.now();

      const shouldBroadcast =
        !localTypingRef.current ||
        now - lastBroadcastRef.current >=
          BROADCAST_INTERVAL;

      localTypingRef.current = true;

      if (
        shouldBroadcast &&
        channelRef.current
      ) {
        channelRef.current.broadcast(true);

        lastBroadcastRef.current = now;
      }

      clearTimeout(inactivityRef.current);

      inactivityRef.current = setTimeout(
        stopTyping,
        INACTIVITY_TIMEOUT
      );
    },
    [canUseTyping, stopTyping]
  );

  /* -------------------- CHANNEL LIFECYCLE -------------------- */

  useEffect(() => {
    if (!canUseTyping) {
      stopTyping();

      setTypingState((current) => {
        if (
          current.conversationId === null &&
          current.userId === null &&
          current.users.length === 0
        ) {
          return current;
        }

        return {
          conversationId: null,
          userId: null,
          users: EMPTY_USERS,
        };
      });

      return;
    }

    let active = true;
    let connection = null;

    const remoteTimers = new Map();

    setTypingState({
      conversationId,
      userId,
      users: EMPTY_USERS,
    });

    /* -------------------- REMOVE REMOTE USER -------------------- */

    function removeUser(id) {
      clearTimeout(remoteTimers.get(id));

      remoteTimers.delete(id);

      if (!active) return;

      setTypingState((current) => {
        if (
          current.conversationId !== conversationId ||
          current.userId !== userId ||
          !current.users.includes(id)
        ) {
          return current;
        }

        return {
          conversationId,
          userId,

          users: current.users.filter(
            (user) => user !== id
          ),
        };
      });
    }

    /* -------------------- RECEIVE TYPING -------------------- */

    function handleTyping(payload) {
      if (!active || !payload) return;

      const {
        userId: senderId,
        typing,
      } = payload;

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
          current.conversationId === conversationId &&
          current.userId === userId
            ? current.users
            : EMPTY_USERS;

        if (users.includes(senderId)) {
          return current;
        }

        return {
          conversationId,
          userId,
          users: [...users, senderId],
        };
      });
    }

    /* -------------------- CONNECT -------------------- */

    async function connect() {
      try {
        const result = await createTypingChannel({
          conversationId,
          userId,

          onTyping: handleTyping,

          onStatus: (connected) => {
            if (!active || !connected) return;

            if (
              localTypingRef.current &&
              channelRef.current
            ) {
              channelRef.current.broadcast(true);

              lastBroadcastRef.current = Date.now();
            }
          },
        });

        // The conversation may have changed or
        // become blocked while connecting.

        if (!active) {
          result.close();
          return;
        }

        connection = result;

        channelRef.current = result;

        if (localTypingRef.current) {
          result.broadcast(true);

          lastBroadcastRef.current = Date.now();
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

    /* -------------------- PAGE VISIBILITY -------------------- */

    function handleVisibility() {
      if (
        document.visibilityState === "hidden"
      ) {
        stopTyping();
      }
    }

    void connect();

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    /* -------------------- CLEANUP -------------------- */

    return () => {
      active = false;

      stopTyping();

      if (channelRef.current === connection) {
        channelRef.current = null;
      }

      connection?.close();

      for (const timer of remoteTimers.values()) {
        clearTimeout(timer);
      }

      remoteTimers.clear();

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };

  }, [
    conversationId,
    userId,
    canUseTyping,
    stopTyping,
  ]);

  /* -------------------- VISIBLE TYPING USERS -------------------- */

  const typingUsers =
    canUseTyping &&
    typingState.conversationId === conversationId &&
    typingState.userId === userId
      ? typingState.users
      : EMPTY_USERS;

  return {
    typingUsers,
    notifyTyping,
    stopTyping,
  };
}