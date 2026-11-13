// src/components/messages/ChatWindow.jsx

"use client";

import { useEffect, useRef, useState } from "react";
import useChatStore from "@/store/useChatStore";
import { subscribeToMessages, getRecipientReadAt } from "@/lib/messages";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

export default function ChatWindow({
  conversationId,
  userId,
}) {
  const bottomRef = useRef(null);

  const [recipientReadAt, setRecipientReadAt] =
    useState(null);

  const messages = useChatStore((s) => s.messages);
  const loading = useChatStore((s) => s.loading);
  const error = useChatStore((s) => s.error);
  const openChat = useChatStore((s) => s.openChat);
  const receiveMessage = useChatStore((s) => s.receiveMessage);
  const markRead = useChatStore((s) => s.markRead);

  // Load the conversation and subscribe to messages
  useEffect(() => {
    const unsubscribe = subscribeToMessages(
      conversationId,
      (message) => {
        receiveMessage(message);

        if (message.sender_id !== userId && document.visibilityState === "visible") {
          markRead(conversationId);
        }
      }
    );

    openChat(conversationId);

    return () => unsubscribe();
  }, [ conversationId, userId, openChat, receiveMessage, markRead ]);

  // Fetch recipient read status periodically
  useEffect(() => {
    let cancelled = false;

    setRecipientReadAt(null);

    async function refreshReadStatus() {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const timestamp = await getRecipientReadAt(conversationId);

        if (!cancelled) {
          setRecipientReadAt(timestamp);
        }
      } catch (error) {
        console.error("Unable to fetch read status:", error.message);
      }
    }

    refreshReadStatus();

    const interval = setInterval(refreshReadStatus, 5000);

    document.addEventListener("visibilitychange", refreshReadStatus);

    return () => {
      cancelled = true;
      clearInterval(interval);

      document.removeEventListener("visibilitychange", refreshReadStatus);
    };
  }, [conversationId]);

  // Mark messages as read when returning to the tab
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        markRead(conversationId);
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [conversationId, markRead]);

  // Scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  function isMessageRead(message) {
    if (!recipientReadAt || message.sender_id !== userId) {
      return false;
    }

    return (new Date(recipientReadAt).getTime() >= new Date(message.created_at).getTime());
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-950">
      <header className="border-b border-gray-800 p-5">
        <h2 className="text-lg font-semibold text-white">
          Conversation
        </h2>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
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

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender_id === userId}
            isRead={isMessageRead(message)}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" className="px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <MessageInput />
    </div>
  );
}
