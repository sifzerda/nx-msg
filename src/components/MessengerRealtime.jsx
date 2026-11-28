// src/components/MessengerRealtime.jsx

"use client";

import { useEffect } from "react";

import { subscribeToAllMessages } from "@/lib/messages";
import { subscribeToPresence } from "@/lib/presence";
import {
  playIncomingMessageSound,
} from "@/lib/notificationSounds";
import useChatStore from "@/store/useChatStore";
import usePresenceStore from "@/store/usePresenceStore";

const REFRESH_DELAY = 250;
const MAX_RECENT_MESSAGES = 500;

const getChat = useChatStore.getState;
const getPresence = usePresenceStore.getState;

export default function MessengerRealtime({ userId }) {
  useEffect(() => {
    if (!userId) {
      getPresence().reset();
      return;
    }

    let active = true;
    let connected = false;
    let hasSubscribed = false;

    let refreshTimer = null;
    let processing = false;

    let pendingRefresh = false;
    let pendingRecovery = false;
    let pendingReadChatId = null;

    const recentMessages = new Set();

    void getPresence().initialize(userId);

    /* -------------------- HELPERS -------------------- */

    function isVisible() {
      return document.visibilityState === "visible";
    }

    function hasPendingWork() {
      return Boolean(
        pendingRefresh ||
        pendingRecovery ||
        pendingReadChatId
      );
    }

    /* -------------------- PRESENCE -------------------- */

    function refreshRestrictions(force = false) {
      const presence = getPresence();

      if (active && presence.userId === userId) {
        void presence.fetchRestrictedUsers({ force });
      }
    }

    function handlePresence(users) {
      const presence = getPresence();

      if (active && presence.userId === userId) {
        presence.setOnlineUsers(users);
      }
    }

    /* -------------------- SCHEDULING -------------------- */

    function scheduleUpdates() {
      if (
        !active ||
        processing ||
        refreshTimer !== null ||
        !hasPendingWork()
      ) {
        return;
      }

      refreshTimer = setTimeout(
        flushUpdates,
        REFRESH_DELAY
      );
    }

    function scheduleRecovery() {
      pendingRecovery = true;
      scheduleUpdates();
    }

    /* -------------------- BATCHED UPDATES -------------------- */

    async function flushUpdates() {
      refreshTimer = null;

      if (!active || processing) return;

      processing = true;

      const recover = pendingRecovery;
      const refresh = pendingRefresh;

      let readChatId = pendingReadChatId;

      pendingRecovery = false;
      pendingRefresh = false;
      pendingReadChatId = null;

      try {
        if (recover) {
          const chatId = getChat().activeChatId;

          if (chatId) {
            const synced =
              await getChat().syncMessages();

            if (!active) return;

            if (
              synced &&
              getChat().activeChatId === chatId &&
              isVisible()
            ) {
              readChatId = chatId;
            }
          }
        }

        if (!active) return;

        const canMarkRead =
          readChatId &&
          getChat().activeChatId === readChatId &&
          isVisible();

        if (canMarkRead) {
          const refreshed =
            await getChat().markRead(readChatId);

          if (!active) return;

          // markRead already refreshes summaries.
          if (refreshed) return;
        }

        if (recover || refresh || readChatId) {
          await getChat().fetchConversations({
            force: true,
          });
        }
      } catch (error) {
        if (active) {
          console.error(
            "Messenger synchronization failed:",
            error
          );
        }
      } finally {
        processing = false;

        // Process events received while the previous
        // synchronization was running.
        scheduleUpdates();
      }
    }

    /* -------------------- EVENT DEDUPLICATION -------------------- */

    function isNewMessage(message) {
      if (
        !message?.id ||
        !message.conversation_id ||
        recentMessages.has(message.id)
      ) {
        return false;
      }

      recentMessages.add(message.id);

      if (
        recentMessages.size > MAX_RECENT_MESSAGES
      ) {
        recentMessages.delete(
          recentMessages.values().next().value
        );
      }

      return true;
    }

    /* -------------------- MESSAGES -------------------- */

 function handleMessage(message) {
  if (!active || !isNewMessage(message)) {
    return;
  }

  const store = getChat();

  const isActiveChat =
    message.conversation_id ===
    store.activeChatId;

  const isOwnMessage =
    message.sender_id === userId;

  let inserted = true;

  if (isActiveChat) {
    inserted = store.receiveMessage(message);
  }

  if (!isOwnMessage && inserted) {
    const conversation =
      store.conversations.find(
        (chat) =>
          chat.id === message.conversation_id
      );

    playIncomingMessageSound({
      message,
      userId,
      isActiveChat,
      isGroup: conversation?.type === "group",
    });
  }

  if (
    isActiveChat &&
    !isOwnMessage &&
    isVisible()
  ) {
    pendingReadChatId =
      message.conversation_id;
  } else {
    pendingRefresh = true;
  }

  scheduleUpdates();
}

    /* -------------------- CONNECTION -------------------- */

    function handleStatus(status) {
      if (!active) return;

      if (status === "SUBSCRIBED") {
        if (connected) return;

        connected = true;

        refreshRestrictions(hasSubscribed);

        hasSubscribed = true;

        scheduleRecovery();

        return;
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        connected = false;

        if (status !== "CLOSED") {
          console.warn(
            "Message subscription status:",
            status
          );
        }
      }
    }

    /* -------------------- BROWSER EVENTS -------------------- */

    function handleVisibilityChange() {
      if (!active || !isVisible()) return;

      refreshRestrictions();

      scheduleRecovery();
    }

    function handleOnline() {
      if (!active) return;

      refreshRestrictions();

      scheduleRecovery();
    }

    function handleOffline() {
      connected = false;
    }

    /* -------------------- SUBSCRIPTIONS -------------------- */

    const unsubscribePresence = subscribeToPresence(
      userId,
      handlePresence
    );

    const unsubscribeMessages = subscribeToAllMessages(
      userId,
      handleMessage,
      handleStatus
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.addEventListener(
      "online",
      handleOnline
    );

    window.addEventListener(
      "offline",
      handleOffline
    );

    /* -------------------- CLEANUP -------------------- */

    return () => {
      active = false;

      clearTimeout(refreshTimer);

      recentMessages.clear();

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener(
        "online",
        handleOnline
      );

      window.removeEventListener(
        "offline",
        handleOffline
      );

      unsubscribePresence();
      unsubscribeMessages();

      const presence = getPresence();

      if (presence.userId === userId) {
        presence.clearOnlineUsers();
      }
    };
  }, [userId]);

  return null;
}