// src/components/ChatWindow.jsx

"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Download, UsersRound, Search } from "lucide-react";

import useChatStore from "@/store/useChatStore";

import useReadReceipts from "@/hooks/useReadReceipts";
import useTypingIndicator from "@/hooks/useTypingIndicator";
import useCurrentDay from "@/hooks/useCurrentDay";
import useReplyMessages from "@/hooks/useReplyMessages";
import useMessageReactions from "@/hooks/useMessageReactions";

import { getMessageProfiles } from "@/lib/messageProfiles";
import { exportChatLog } from "@/lib/chatExport";
import { groupMessagesByDate } from "@/utils/messageDates";

import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";
import DateSeparator from "./DateSeparator";
import ConversationSearch from "./ConversationSearch";

const EMPTY_MESSAGES = [];
const EMPTY_NAMES = [];
const EMPTY_REACTIONS = [];

const SCROLL_THRESHOLD = 100;

export default function ChatWindow({
  conversationId,
  userId,
}) {
  const messagesContainerRef = useRef(null);
  const shouldScrollRef = useRef(true);
  const previousConversationRef = useRef(null);
  const previousMessageIdRef = useRef(null);

  const [profiles, setProfiles] = useState({});
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Zustand selectors
  const messages = useChatStore((state) =>
    state.activeChatId === conversationId
      ? state.messages
      : EMPTY_MESSAGES
  );

  const chat = useChatStore((state) =>
    state.conversations.find(
      (item) => item.id === conversationId
    )
  );

  const loading = useChatStore((s) => s.loading);
  const error = useChatStore((s) => s.error);

  const replyTo = useChatStore((s) => s.replyTo);
  const setReplyTo = useChatStore((s) => s.setReplyTo);

  const openChat = useChatStore((s) => s.openChat);
  const closeChat = useChatStore((s) => s.closeChat);
  const markRead = useChatStore((s) => s.markRead);

  // Conversation details
  const isGroup = chat?.type === "group";

  const chatName = isGroup
    ? chat?.group_name || "Unnamed Group"
    : chat?.other_display_name ||
      chat?.other_username ||
      "Conversation";

  // Date separators
  const now = useCurrentDay();

  const messageGroups = useMemo(
    () => groupMessagesByDate(messages),
    [messages]
  );

  // Message replies
  const replyMessages = useReplyMessages(
    conversationId,
    messages
  );

  // Emoji reactions
  const {
    reactionsByMessage,
    toggleReaction,
    reactionError,
  } = useMessageReactions(
    conversationId,
    userId,
    messages
  );

  // Private read receipts
  const recipientReadAt = useReadReceipts(
    conversationId,
    userId,
    chat?.type === "private"
  );

  const recipientReadTime = recipientReadAt
    ? Date.parse(recipientReadAt)
    : 0;

  // Typing indicators
  const {
    typingUsers,
    notifyTyping,
    stopTyping,
  } = useTypingIndicator(
    conversationId,
    userId
  );

  // Search controls
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen((current) => !current);
  }, []);

  // Open and close the active conversation
  useEffect(() => {
    if (!conversationId) return;

    void openChat(conversationId);

    return () => {
      closeChat(conversationId);
    };
  }, [conversationId, openChat, closeChat]);

  // Reset conversation-specific UI state
  useEffect(() => {
    setExportError(null);
    setSearchOpen(false);
  }, [conversationId]);

  // Identify required group member profiles
  const senderKey = useMemo(() => {
    if (!isGroup) return "";

    const ids = new Set();

    for (const message of replyMessages.values()) {
      if (
        message?.sender_id &&
        message.sender_id !== userId
      ) {
        ids.add(message.sender_id);
      }
    }

    for (const id of typingUsers) {
      if (id !== userId) {
        ids.add(id);
      }
    }

    return [...ids].sort().join(",");
  }, [
    isGroup,
    replyMessages,
    typingUsers,
    userId,
  ]);

  // Load group member profiles
  useEffect(() => {
    if (!senderKey) return;

    let cancelled = false;

    async function loadProfiles() {
      try {
        const result = await getMessageProfiles(
          senderKey.split(",")
        );

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

    void loadProfiles();

    return () => {
      cancelled = true;
    };
  }, [senderKey]);

  // Resolve sender names
  const getSenderName = useCallback(
    (message) => {
      if (!message) return "Member";

      if (message.sender_id === userId) {
        return "You";
      }

      if (!isGroup) {
        return chatName;
      }

      const profile = profiles[message.sender_id];

      return (
        profile?.display_name ||
        profile?.username ||
        "Member"
      );
    },
    [userId, isGroup, chatName, profiles]
  );

  // Convert typing user IDs into names
  const typingNames = useMemo(() => {
    if (!chat || !typingUsers.length) {
      return EMPTY_NAMES;
    }

    if (!isGroup) {
      return typingUsers.includes(chat.other_user_id)
        ? [chatName]
        : EMPTY_NAMES;
    }

    return typingUsers.map((id) => {
      const profile = profiles[id];

      return (
        profile?.display_name ||
        profile?.username ||
        "Member"
      );
    });
  }, [
    chat,
    isGroup,
    chatName,
    typingUsers,
    profiles,
  ]);

  // Mark conversation as read when visible
  useEffect(() => {
    if (!conversationId) return;

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void markRead(conversationId);
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

  // Track whether the user is near the bottom
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;

    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    shouldScrollRef.current =
      distanceFromBottom <= SCROLL_THRESHOLD;
  }, []);

  // Intelligent automatic scrolling
  useLayoutEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) return;

    const conversationChanged =
      previousConversationRef.current !== conversationId;

    if (conversationChanged) {
      previousConversationRef.current = conversationId;
      previousMessageIdRef.current = null;
      shouldScrollRef.current = true;
    }

    const latestMessage =
      messages[messages.length - 1];

    if (!latestMessage) {
      previousMessageIdRef.current = null;
      shouldScrollRef.current = true;
      return;
    }

    const initialLoad =
      previousMessageIdRef.current === null;

    const newMessage =
      previousMessageIdRef.current !== latestMessage.id;

    const ownNewMessage =
      newMessage &&
      latestMessage.sender_id === userId;

    if (
      conversationChanged ||
      initialLoad ||
      ownNewMessage ||
      shouldScrollRef.current
    ) {
      container.scrollTop = container.scrollHeight;
      shouldScrollRef.current = true;
    }

    previousMessageIdRef.current = latestMessage.id;
  }, [conversationId, messages, userId]);

  // Keep the bottom visible when composer height changes
  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (shouldScrollRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Jump to a loaded message
  const jumpToMessage = useCallback((messageId) => {
    const container = messagesContainerRef.current;

    if (!container) return;

    const element = document.getElementById(
      `message-${messageId}`
    );

    if (!element || !container.contains(element)) {
      return;
    }

    shouldScrollRef.current = false;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    element.scrollIntoView({
      behavior: reducedMotion ? "instant" : "smooth",
      block: "center",
    });

    if (!reducedMotion) {
      element.animate(
        [
          {
            backgroundColor: "rgba(59, 130, 246, 0.3)",
          },
          {
            backgroundColor: "transparent",
          },
        ],
        {
          duration: 1500,
          easing: "ease-out",
        }
      );
    }
  }, []);

  // Download complete conversation history
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
      console.error("Failed to export chat:", error);

      setExportError(
        error.message ||
        "Unable to download chat log."
      );
    } finally {
      setExporting(false);
    }
  }

  // Determine private message read status
  const isMessageRead = useCallback(
    (message) => {
      return (
        !isGroup &&
        message.sender_id === userId &&
        recipientReadTime > 0 &&
        recipientReadTime >=
          Date.parse(message.created_at)
      );
    },
    [isGroup, userId, recipientReadTime]
  );

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-gray-950">

      {/* ROW 1: Conversation header and search */}
      <div className="min-w-0">

        <header className="flex items-center gap-3 border-b border-gray-800 p-4">

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

          {/* Search button */}
          <button
            type="button"
            onClick={toggleSearch}
            aria-label="Search conversation"
            aria-expanded={searchOpen}
            title="Search conversation"
            className={`flex shrink-0 items-center justify-center rounded-lg border p-2.5 transition-colors ${
              searchOpen
                ? "border-blue-500 bg-blue-600/20 text-blue-400"
                : "border-gray-700 bg-gray-900 text-gray-300 hover:border-blue-500 hover:text-white"
            }`}
          >
            <Search size={18} />
          </button>

          {/* Export button */}
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

        {/* Export errors */}
        {exportError && (
          <div
            role="alert"
            className="border-b border-red-900/40 bg-red-950/30 px-4 py-2 text-sm text-red-400"
          >
            {exportError}
          </div>
        )}

        {/* Search panel — inside the header wrapper */}
        {searchOpen && (
          <ConversationSearch
            key={conversationId}
            conversationId={conversationId}
            userId={userId}
            messages={messages}
            onClose={closeSearch}
            onJumpToMessage={jumpToMessage}
          />
        )}
      </div>

      {/* ROW 2: Scrollable messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="min-h-0 min-w-0 space-y-3 overflow-y-auto overscroll-contain p-4"
      >
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

        {messageGroups.map((group) => (
          <section
            key={group.key}
            className="space-y-3"
          >
            <DateSeparator
              date={group.date}
              now={now}
            />

            {group.messages.map((message) => {
              const isOwn =
                message.sender_id === userId;

              const quotedMessage =
                replyMessages.get(message.reply_to_id);

              return (
                <div
                  key={message.id}
                  id={`message-${message.id}`}
                  className="rounded-xl"
                >
                  {isGroup && !isOwn && (
                    <p className="mb-1 ml-2 text-xs font-medium text-blue-400">
                      {getSenderName(message)}
                    </p>
                  )}

                  <MessageBubble
                    message={message}
                    isOwn={isOwn}
                    isRead={isMessageRead(message)}
                    showReadStatus={!isGroup}

                    quotedMessage={quotedMessage}
                    quotedSenderName={getSenderName(
                      quotedMessage
                    )}
                    onReply={setReplyTo}
                    onJumpToMessage={jumpToMessage}

                    userId={userId}
                    reactions={
                      reactionsByMessage.get(message.id) ??
                      EMPTY_REACTIONS
                    }
                    onToggleReaction={toggleReaction}
                  />
                </div>
              );
            })}
          </section>
        ))}
      </div>

      {/* ROW 3: Message composer */}
      <div className="min-w-0 border-t border-gray-800 bg-gray-950">

        {/* Message errors */}
        {error && (
          <p
            role="alert"
            className="px-4 py-2 text-sm text-red-400"
          >
            {error}
          </p>
        )}

        {/* Reaction errors */}
        {reactionError && (
          <p
            role="alert"
            className="px-4 py-2 text-sm text-red-400"
          >
            {reactionError}
          </p>
        )}

        {/* Typing indicator */}
        <TypingIndicator names={typingNames} />

        {/* Message input */}
        <MessageInput
          key={conversationId}
          userId={userId}
          onTyping={notifyTyping}
          onStopTyping={stopTyping}
          replySenderName={getSenderName(replyTo)}
        />
      </div>
    </div>
  );
}