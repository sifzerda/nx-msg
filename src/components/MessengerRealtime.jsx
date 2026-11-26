// src/components/MessengerRealtime.jsx

"use client";

import { useEffect } from "react";
import { subscribeToAllMessages } from "@/lib/messages";
import { subscribeToPresence } from "@/lib/presence";
import useChatStore from "@/store/useChatStore";
import usePresenceStore from "@/store/usePresenceStore";

/* -------------------- CONSTANTS -------------------- */

const REFRESH_DELAY = 150;

/* -------------------- COMPONENT -------------------- */

export default function MessengerRealtime({ userId }) {
  useEffect(() => {
    if (!userId) {
      usePresenceStore.getState().reset();
      return;
    }

    let active = true;
    let refreshTimer = null;
    let hasSubscribed = false;

    /* -------------------- INITIALIZE PRESENCE -------------------- */

    void usePresenceStore
      .getState()
      .initialize(userId);

    /* -------------------- RESTRICTION REFRESH -------------------- */

    function refreshRestrictions(force = false) {
      if (!active) return;

      const presenceStore = usePresenceStore.getState();

      if (presenceStore.userId !== userId) {
        return;
      }

      void presenceStore.fetchRestrictedUsers({
        force,
      });
    }

    /* -------------------- CONVERSATION REFRESH -------------------- */

    function scheduleRefresh() {
      if (!active || refreshTimer !== null) {
        return;
      }

      refreshTimer = setTimeout(() => {
        refreshTimer = null;

        if (!active) return;

        void useChatStore
          .getState()
          .fetchConversations();

      }, REFRESH_DELAY);
    }

    /* -------------------- MESSAGE HANDLING -------------------- */

    function handleMessage(message) {
      if (!active) return;

      const store = useChatStore.getState();
      const isActiveChat = message.conversation_id === store.activeChatId;

      if (isActiveChat) {
        store.receiveMessage(message);
      }

      const shouldMarkRead = isActiveChat && message.sender_id !== userId && document.visibilityState === "visible";

      if (shouldMarkRead) {
        void store.markRead(message.conversation_id);
      } else {
        scheduleRefresh();
      }
    }

    /* -------------------- PRESENCE SUBSCRIPTION -------------------- */

    const unsubscribePresence = subscribeToPresence(userId, (users) => {
        if (!active) return;

        const presenceStore = usePresenceStore.getState();

        if (presenceStore.userId !== userId) {
          return;
        }

        presenceStore.setOnlineUsers(users);
      });

    /* -------------------- MESSAGE SUBSCRIPTION -------------------- */

    const unsubscribeMessages =
      subscribeToAllMessages(
        userId,
        handleMessage,
        (status) => {
          if (!active) return;

          if (status === "SUBSCRIBED") {
            scheduleRefresh();

            // Refresh restrictions after reconnection,
            // but avoid duplicating the initial request.
            if (hasSubscribed) {
              refreshRestrictions();
            }

            hasSubscribed = true;

            const store = useChatStore.getState();

            if (store.activeChatId) {
              void store.syncMessages();
            }

            return;
          }

          if (
            status === "CHANNEL_ERROR" || status === "TIMED_OUT"
          ) {
            console.warn("Message subscription status:", status);
          }
        }
      );

    /* -------------------- BROWSER VISIBILITY -------------------- */

    function handleVisibilityChange() {
      if (
        !active || document.visibilityState !== "visible"
      ) {
        return;
      }

      // Uses the cached result if it is still valid.
      refreshRestrictions();
    }

    /* -------------------- NETWORK RECONNECTION -------------------- */

    function handleOnline() {
      if (!active) return;

      refreshRestrictions(true);
      scheduleRefresh();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    /* -------------------- CLEANUP -------------------- */

    return () => {
      active = false;

      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
      }

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);

      unsubscribePresence();
      unsubscribeMessages();

      const presenceStore = usePresenceStore.getState();

      // Preserve cached restrictions during remounts.
      // Logout and account switching perform a full reset.
      if (presenceStore.userId === userId) {
        presenceStore.clearOnlineUsers();
      }
    };

  }, [userId]);

  return null;
}