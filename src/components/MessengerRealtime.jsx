// src/components/MessengerRealtime.jsx

"use client";

import { useEffect } from "react";
import { subscribeToAllMessages } from "@/lib/messages";
import { subscribeToPresence } from "@/lib/presence";
import useChatStore from "@/store/useChatStore";
import usePresenceStore from "@/store/usePresenceStore";

const REFRESH_DELAY = 150;

export default function MessengerRealtime({ userId }) {
  useEffect(() => {
    if (!userId) return;

    let active = true;
    let refreshTimer = null;

    function scheduleRefresh() {
      if (!active || refreshTimer !== null) return;

      refreshTimer = setTimeout(() => {
        refreshTimer = null;

        if (active) {
          void useChatStore
            .getState()
            .fetchConversations();
        }
      }, REFRESH_DELAY);
    }

    function handleMessage(message) {
      if (!active) return;

      const store = useChatStore.getState();

      const isActiveChat =
        message.conversation_id === store.activeChatId;

      if (isActiveChat) {
        store.receiveMessage(message);
      }

      const shouldMarkRead =
        isActiveChat &&
        message.sender_id !== userId &&
        document.visibilityState === "visible";

      if (shouldMarkRead) {
        void store.markRead(message.conversation_id);
      } else {
        scheduleRefresh();
      }
    }

    const unsubscribePresence = subscribeToPresence(
      userId,
      (users) => {
        if (active) {
          usePresenceStore
            .getState()
            .setOnlineUsers(users);
        }
      }
    );

    const unsubscribeMessages = subscribeToAllMessages(
      userId,
      handleMessage,
      (status) => {
        if (!active) return;

        if (status === "SUBSCRIBED") {
          scheduleRefresh();

          const store = useChatStore.getState();

          if (store.activeChatId) {
            void store.syncMessages();
          }
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          console.warn("Message subscription status:", status);
        }
      }
    );

    return () => {
      active = false;

      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
      }

      unsubscribePresence();
      unsubscribeMessages();

      usePresenceStore.getState().reset();
    };
  }, [userId]);

  return null;
}
