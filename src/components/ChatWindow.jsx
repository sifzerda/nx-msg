// src/components/ChatWindow.jsx

"use client";

import { useEffect, useRef, useState } from "react";
import { Download, UsersRound } from "lucide-react";
import useChatStore from "@/store/useChatStore";
import { subscribeToMessages, getRecipientReadAt } from "@/lib/messages";
import { getMessageProfiles } from "@/lib/messageProfiles";
import { exportChatLog } from "@/lib/chatExport";

import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

export default function ChatWindow({ conversationId, userId }) {
  const messagesContainerRef = useRef(null);

  const [recipientReadAt, setRecipientReadAt] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const messages = useChatStore((s) => s.messages);
  const conversations = useChatStore((s) => s.conversations);
  const loading = useChatStore((s) => s.loading);
  const error = useChatStore((s) => s.error);
  const openChat = useChatStore((s) => s.openChat);
  const receiveMessage = useChatStore((s) => s.receiveMessage);
  const markRead = useChatStore((s) => s.markRead);

  const chat = conversations.find(
    (c) => c.id === conversationId
  );

  const isGroup = chat?.type === "group";

  const chatName = isGroup
    ? chat?.group_name || "Unnamed Group"
    : chat?.other_display_name ||
    chat?.other_username ||
    "Conversation";

  // Load messages and subscribe to Realtime.
  useEffect(() => {
    if (!conversationId) return;

    openChat(conversationId);

    const unsubscribe = subscribeToMessages(
      conversationId,
      (message) => {
        receiveMessage(message);

        if (
          message.sender_id !== userId &&
          document.visibilityState === "visible"
        ) {
          markRead(conversationId);
        }
      }
    );

    return unsubscribe;
  }, [
    conversationId,
    userId,
    openChat,
    receiveMessage,
    markRead,
  ]);

  // Load sender profiles for group messages.
  useEffect(() => {
    if (!isGroup || !messages.length) return;

    let cancelled = false;

    async function loadProfiles() {
      try {
        const userIds = [
          ...new Set(
            messages
              .map((message) => message.sender_id)
              .filter(Boolean)
          ),
        ];

        const result = await getMessageProfiles(userIds);

        if (!cancelled) {
          setProfiles((current) => ({
            ...current,
            ...result,
          }));
        }
      } catch (error) {
        console.error(
          "Failed to load sender profiles:",
          error
        );
      }
    }

    loadProfiles();

    return () => {
      cancelled = true;
    };
  }, [isGroup, messages]);

  // Read receipts for private chats.
  useEffect(() => {
    if (!chat || isGroup) {
      setRecipientReadAt(null);
      return;
    }

    let cancelled = false;

    async function refreshReadStatus() {
      if (document.visibilityState !== "visible") return;

      try {
        const timestamp = await getRecipientReadAt(
          conversationId
        );

        if (!cancelled) {
          setRecipientReadAt(timestamp);
        }
      } catch (error) {
        console.error(
          "Failed to load read status:",
          error
        );
      }
    }

    refreshReadStatus();

    const interval = setInterval(
      refreshReadStatus,
      5000
    );

    document.addEventListener(
      "visibilitychange",
      refreshReadStatus
    );

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        refreshReadStatus
      );
    };
  }, [conversationId, chat?.type, isGroup]);

  // Mark conversation as read when tab becomes visible.
  useEffect(() => {
    if (!conversationId) return;

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        markRead(conversationId);
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [conversationId, markRead]);

  // Scroll to newest message.
  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) return;

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  // Reset export errors when switching conversations.
  useEffect(() => {
    setExportError(null);
  }, [conversationId]);

  // Download the complete conversation history.
  async function handleExportChat() {
    if (!conversationId || exporting) return;

    setExporting(true);
    setExportError(null);

    try {
      await exportChatLog({
        id: conversationId,
        name: chatName,
        type: chat?.type,
      });
    } catch (error) {
      console.error(
        "Failed to export chat:",
        error
      );

      setExportError(
        error.message ||
        "Unable to download chat log."
      );
    } finally {
      setExporting(false);
    }
  }

  function isMessageRead(message) {
    if (
      isGroup ||
      !recipientReadAt ||
      message.sender_id !== userId
    ) {
      return false;
    }

    return (
      new Date(recipientReadAt).getTime() >=
      new Date(message.created_at).getTime()
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-gray-950">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-gray-800 p-5">
        {isGroup && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
            <UsersRound size={22} />
          </div>
        )}

        {/* Conversation information */}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-white">
            {chatName}
          </h2>

          {isGroup && (
            <p className="text-xs text-gray-400">
              {chat?.member_count ?? 0} members
            </p>
          )}
        </div>

        {/* Download chat log */}
        <button
          type="button"
          onClick={handleExportChat}
          disabled={!conversationId || exporting}
          title="Download complete chat history"
          aria-label="Download chat log"
          className="flex shrink-0 items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-blue-500 hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={17} />

          <span className="hidden sm:inline">
            {exporting
              ? "Exporting..."
              : "Download chat"}
          </span>
        </button>
      </header>

      {/* Export error */}
      {exportError && (
        <div
          role="alert"
          className="border-b border-red-900/40 bg-red-950/30 px-5 py-3 text-sm text-red-400"
        >
          {exportError}
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-5">
        {loading && (
          <p className="text-gray-400">
            Loading messages...
          </p>
        )}

        {!loading && messages.length === 0 && (
          <p className="text-center text-gray-500">
            No messages yet. Say hello!
          </p>
        )}

        {messages.map((message) => {
          const isOwn =
            message.sender_id === userId;

          const sender =
            profiles[message.sender_id];

          return (
            <div key={message.id}>
              {isGroup && !isOwn && (
                <p className="mb-1 ml-2 text-xs font-medium text-blue-400">
                  {sender?.display_name ||
                    sender?.username ||
                    "Member"}
                </p>
              )}

              <MessageBubble
                message={message}
                isOwn={isOwn}
                isRead={isMessageRead(message)}
                showReadStatus={!isGroup}
              />
            </div>
          );
        })}

      </div>

      {/* Messaging errors */}
      {error && (
        <p
          role="alert"
          className="px-4 py-2 text-sm text-red-400"
        >
          {error}
        </p>
      )}

      {/* Message composer */}
      <div className="shrink-0 border-t border-gray-800">
        <MessageInput />
      </div>
    </div>
  );
}
