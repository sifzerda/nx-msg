// src/hooks/useTypingIndicator.js

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { createTypingChannel } from "@/lib/extras/typing";

const BROADCAST_INTERVAL = 3000;
const INACTIVITY_TIMEOUT = 2000;
const REMOTE_TIMEOUT = 7000;

const EMPTY_USERS = Object.freeze([]);

export default function useTypingIndicator(
  conversationId,
  userId,
  { enabled = true } = {}
) {
  const sessionRef = useRef(null);
  const [typingState, setTypingState] = useState(null);
  const canUseTyping = Boolean(enabled && conversationId && userId);

  /* -------------------- PUBLIC ACTIONS -------------------- */

  const notifyTyping = useCallback(
    (value) => {
      const session = sessionRef.current;

      if (
        !canUseTyping ||
        session?.conversationId !== conversationId ||
        session?.userId !== userId
      ) {
        return;
      }

      session.notify(value);
    },
    [canUseTyping, conversationId, userId]
  );

  const stopTyping = useCallback(() => {
    const session = sessionRef.current;

    if (
      session?.conversationId === conversationId &&
      session?.userId === userId
    ) {
      session.stop();
    }
  }, [conversationId, userId]);

  /* -------------------- SESSION -------------------- */

  useEffect(() => {
    if (!canUseTyping) return;

    let active = true;
    let connection = null;

    let localTyping = false;
    let lastBroadcastAt = null;
    let inactivityTimer = null;

    const remoteTimers = new Map();

    const session = {
      conversationId,
      userId,
      notify,
      stop,
    };

    sessionRef.current = session;

    /* -------------------- LOCAL TYPING -------------------- */

    function broadcastTyping() {
      if (!active || !localTyping) return;

      const now = Date.now();

      if (
        lastBroadcastAt !== null &&
        now - lastBroadcastAt < BROADCAST_INTERVAL
      ) {
        return;
      }

      if (connection?.broadcast(true)) {
        lastBroadcastAt = now;
      }
    }

    function stop() {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;

      if (!localTyping) return;

      localTyping = false;
      lastBroadcastAt = null;

      connection?.broadcast(false);
    }

    function notify(value) {
      if (!active) return;

      if (
        typeof value !== "string" ||
        !value.trim() ||
        document.visibilityState === "hidden"
      ) {
        stop();
        return;
      }

      localTyping = true;

      broadcastTyping();

      clearTimeout(inactivityTimer);

      inactivityTimer = setTimeout(
        stop,
        INACTIVITY_TIMEOUT
      );
    }

    /* -------------------- REMOTE TYPING -------------------- */

    function publishUsers() {
      if (!active) return;

      setTypingState({
        session,
        conversationId,
        userId,
        users: remoteTimers.size
          ? [...remoteTimers.keys()]
          : EMPTY_USERS,
      });
    }

    function removeUser(id) {
      if (!remoteTimers.has(id)) return;

      clearTimeout(remoteTimers.get(id));

      remoteTimers.delete(id);

      publishUsers();
    }

    function clearRemoteUsers(publish = true) {
      if (!remoteTimers.size) return;

      for (const timer of remoteTimers.values()) {
        clearTimeout(timer);
      }

      remoteTimers.clear();

      if (publish) {
        publishUsers();
      }
    }

    function handleTyping(payload) {
      if (
        !active ||
        !payload ||
        typeof payload.userId !== "string" ||
        payload.userId === userId ||
        typeof payload.typing !== "boolean"
      ) {
        return;
      }

      const {
        userId: senderId,
        typing,
      } = payload;

      if (!typing) {
        removeUser(senderId);
        return;
      }

      const alreadyTyping =
        remoteTimers.has(senderId);

      clearTimeout(remoteTimers.get(senderId));

      remoteTimers.set(
        senderId,
        setTimeout(() => {
          removeUser(senderId);
        }, REMOTE_TIMEOUT)
      );

      // Heartbeats only extend the expiry timer.
      // They do not need to update React state.
      if (!alreadyTyping) {
        publishUsers();
      }
    }

    /* -------------------- CONNECTION -------------------- */

    function handleStatus(connected) {
      if (!active) return;

      lastBroadcastAt = null;

      if (connected) {
        broadcastTyping();
      } else {
        clearRemoteUsers();
      }
    }

    async function connect() {
      try {
        const result = await createTypingChannel({
          conversationId,
          userId,
          onTyping: handleTyping,
          onStatus: handleStatus,
        });

        if (!active) {
          result.close();
          return;
        }

        connection = result;

        // Handles a subscription becoming ready
        // before the asynchronous setup completes.
        if (connection.isConnected()) {
          broadcastTyping();
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

    /* -------------------- VISIBILITY -------------------- */

    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        stop();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    void connect();

    /* -------------------- CLEANUP -------------------- */

    return () => {
      active = false;

      stop();

      clearRemoteUsers(false);

      connection?.close();

      if (sessionRef.current === session) {
        sessionRef.current = null;
      }

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [conversationId, userId, canUseTyping]);

  /* -------------------- VISIBLE USERS -------------------- */

  const typingUsers =
    canUseTyping &&
    typingState?.conversationId === conversationId &&
    typingState?.userId === userId
      ? typingState.users
      : EMPTY_USERS;

  return {
    typingUsers,
    notifyTyping,
    stopTyping,
  };
}