// src/components/ChatWindow.jsx

"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useShallow } from "zustand/react/shallow";

import {
  Download,
  UsersRound,
  Search,
} from "lucide-react";

import useChatStore from "@/store/useChatStore";

import useReadReceipts from "@/hooks/useReadReceipts";
import useTypingIndicator from "@/hooks/useTypingIndicator";
import useCurrentDay from "@/hooks/useCurrentDay";
import useReplyMessages from "@/hooks/useReplyMessages";
import useMessageReactions from "@/hooks/useMessageReactions";

import { getMessageProfiles } from "@/lib/messageProfiles";

import {
  groupMessagesByDate,
  formatMessageDate,
} from "@/utils/messageUtils";

import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import BlockedComposer from "./BlockedComposer";
import ChatBlockMenu from "./extras/ChatBlockMenu";
import ConversationSearch from "./extras/ConversationSearch";

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_PROFILES = Object.freeze({});
const SCROLL_THRESHOLD = 100;

/* -------------------- HELPERS -------------------- */

function getProfileName(profile) {
  return (
    profile?.display_name ||
    profile?.username ||
    "Member"
  );
}

function getChatName(chat) {
  return chat?.type === "group"
    ? chat.group_name || "Unnamed Group"
    : chat?.other_display_name ||
        chat?.other_username ||
        "Conversation";
}

function scrollToBottom(container) {
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

function getTypingLabel(names) {
  const count = names.length;

  if (!count) return "";

  if (count === 1) {
    return `${names[0]} is typing...`;
  }

  if (count <= 3) {
    return `${names.slice(0, -1).join(", ")} and ${
      names[count - 1]
    } are typing...`;
  }

  return `${count} people are typing...`;
}

function setReplyTo(message) {
  useChatStore.getState().setReplyTo(message);
}

/* -------------------- DATE SEPARATOR -------------------- */

const DateSeparator = memo(function DateSeparator({
  date,
  now,
}) {
  return (
    <div className="flex select-none items-center gap-3 py-3">
      <div className="h-px flex-1 bg-gray-800" />

      <time className="shrink-0 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-gray-400">
        {formatMessageDate(date, now)}
      </time>

      <div className="h-px flex-1 bg-gray-800" />
    </div>
  );
});

/* -------------------- TYPING INDICATOR -------------------- */

const TypingIndicator = memo(function TypingIndicator({
  names = EMPTY_ARRAY,
}) {
  if (!names.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-w-0 items-center gap-2 px-4 py-2"
    >
      <div
        aria-hidden="true"
        className="flex shrink-0 items-center gap-1 rounded-full bg-gray-800 px-3 py-2"
      >
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 motion-reduce:animate-none"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>

      <span className="truncate text-xs text-gray-400">
        {getTypingLabel(names)}
      </span>
    </div>
  );
});

/* -------------------- GROUP PROFILES -------------------- */

function useGroupProfiles({
  isGroup,
  messages,
  replyMessages,
  typingUsers,
  userId,
}) {
  const [profiles, setProfiles] = useState(EMPTY_PROFILES);

  const senderKey = useMemo(() => {
    if (!isGroup) return "";

    const ids = new Set();

    function addSender(message) {
      const id = message?.sender_id;

      if (id && id !== userId) {
        ids.add(id);
      }
    }

    for (const message of messages) {
      addSender(message);
    }

    for (const message of replyMessages.values()) {
      addSender(message);
    }

    for (const id of typingUsers) {
      if (id && id !== userId) {
        ids.add(id);
      }
    }

    return [...ids].sort().join(",");
  }, [
    isGroup,
    messages,
    replyMessages,
    typingUsers,
    userId,
  ]);

  useEffect(() => {
    if (!senderKey) return;

    let active = true;

    async function loadProfiles() {
      try {
        const result = await getMessageProfiles(
          senderKey.split(",")
        );

        if (!active || !result) return;

        setProfiles((current) => {
          let next = current;

          for (const [id, profile] of Object.entries(result)) {
            const previous = current[id];

            if (
              previous &&
              previous.display_name === profile?.display_name &&
              previous.username === profile?.username
            ) {
              continue;
            }

            if (next === current) {
              next = { ...current };
            }

            next[id] = profile;
          }

          return next;
        });
      } catch (error) {
        if (active) {
          console.error(
            "Failed to load sender profiles:",
            error
          );
        }
      }
    }

    void loadProfiles();

    return () => {
      active = false;
    };
  }, [senderKey]);

  return profiles;
}

/* -------------------- MESSAGE ROW -------------------- */

const MessageRow = memo(function MessageRow({
  message,
  userId,
  isGroup,
  isRead,
  senderName,
  quotedMessage,
  quotedSenderName,
  reactions,
  onReply,
  onJumpToMessage,
  onToggleReaction,
}) {
  const isOwn = message.sender_id === userId;

  return (
    <div
      id={`message-${message.id}`}
      className="rounded-xl"
    >
      {isGroup && !isOwn && (
        <p className="mb-1 ml-2 text-xs font-medium text-blue-400">
          {senderName}
        </p>
      )}

      <MessageBubble
        message={message}
        isOwn={isOwn}
        isRead={isRead}
        showReadStatus={!isGroup}
        quotedMessage={quotedMessage}
        quotedSenderName={quotedSenderName}
        onReply={onReply}
        onJumpToMessage={onJumpToMessage}
        userId={userId}
        reactions={reactions}
        onToggleReaction={onToggleReaction}
      />
    </div>
  );
});

/* -------------------- MESSAGE LIST -------------------- */

const MessageList = memo(function MessageList({
  messages,
  loading,
  userId,
  isGroup,
  canSendMessages,
  recipientReadTime,
  replyMessages,
  reactionsByMessage,
  getSenderName,
  onJumpToMessage,
  onToggleReaction,
  containerRef,
  onScroll,
}) {
  const now = useCurrentDay();

  const groups = useMemo(
    () => groupMessagesByDate(messages),
    [messages]
  );

  const onReply = canSendMessages
    ? setReplyTo
    : undefined;

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="min-h-0 min-w-0 overflow-y-auto overscroll-contain p-4"
    >
      <div className="space-y-3">
        {loading && (
          <p className="text-gray-400">
            Loading messages...
          </p>
        )}

        {!loading && !messages.length && (
          <p className="text-center text-gray-500">
            {canSendMessages
              ? "No messages yet. Say hello!"
              : "No messages yet."}
          </p>
        )}

        {groups.map((group) => (
          <section
            key={group.key}
            className="space-y-3"
          >
            <DateSeparator
              date={group.date}
              now={now}
            />

            {group.messages.map((message) => {
              const isOwn = message.sender_id === userId;

              const quotedMessage = replyMessages.get(
                message.reply_to_id
              );

              const isRead =
                !isGroup &&
                isOwn &&
                recipientReadTime > 0 &&
                recipientReadTime >= Date.parse(message.created_at);

              return (
                <MessageRow
                  key={message.id}
                  message={message}
                  userId={userId}
                  isGroup={isGroup}
                  isRead={isRead}
                  senderName={
                    isGroup && !isOwn
                      ? getSenderName(message)
                      : undefined
                  }
                  quotedMessage={quotedMessage}
                  quotedSenderName={
                    message.reply_to_id
                      ? getSenderName(quotedMessage)
                      : undefined
                  }
                  reactions={
                    reactionsByMessage.get(message.id) ??
                    EMPTY_ARRAY
                  }
                  onReply={onReply}
                  onJumpToMessage={onJumpToMessage}
                  onToggleReaction={onToggleReaction}
                />
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
});

/* -------------------- CONVERSATION HEADER -------------------- */

const ConversationHeader = memo(function ConversationHeader({
  conversationId,
  userId,
  chat,
  chatName,
  isGroup,
  isPrivate,
  isBlockedByMe,
  messagingUnavailable,
  messages,
  onJumpToMessage,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const exportingRef = useRef(false);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  async function handleExportChat() {
    if (!conversationId || exportingRef.current) return;

    exportingRef.current = true;

    setExporting(true);
    setExportError(null);

    try {
      const { exportChatLog } = await import(
        "@/lib/chatExport"
      );

      await exportChatLog({
        id: conversationId,
        name: chatName,
        type: chat?.type,
      });
    } catch (error) {
      console.error("Failed to export chat:", error);

      setExportError(
        error?.message || "Unable to download chat log."
      );
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }

  return (
    <div className="min-w-0">
      <header className="flex items-center gap-3 border-b border-gray-800 p-4">
        {isGroup && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
            <UsersRound size={22} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-white">
            {chatName}
          </h2>

          {isGroup && (
            <p className="text-xs text-gray-400">
              {chat?.member_count ?? 0} members
            </p>
          )}

          {isPrivate && messagingUnavailable && (
            <p className="mt-0.5 text-xs text-gray-400">
              {isBlockedByMe
                ? "You have blocked this user"
                : "Messaging unavailable"}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setSearchOpen((value) => !value)}
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
            {exporting ? "Exporting..." : "Download chat"}
          </span>
        </button>

        {isPrivate && chat?.other_user_id && (
          <ChatBlockMenu
            key={`${userId}:${conversationId}`}
            userId={chat.other_user_id}
            displayName={chatName}
            isBlocked={isBlockedByMe}
          />
        )}
      </header>

      {exportError && (
        <div
          role="alert"
          className="border-b border-red-900/40 bg-red-950/30 px-4 py-2 text-sm text-red-400"
        >
          {exportError}
        </div>
      )}

      {searchOpen && (
        <ConversationSearch
          conversationId={conversationId}
          userId={userId}
          messages={messages}
          onClose={closeSearch}
          onJumpToMessage={onJumpToMessage}
        />
      )}
    </div>
  );
});

/* -------------------- CHAT SESSION -------------------- */

function ChatSession({
  conversationId,
  userId,
}) {
  const messagesContainerRef = useRef(null);
  const shouldScrollRef = useRef(true);
  const previousMessageIdRef = useRef(null);

  const {
    messages,
    chat,
    loading,
    error,
    replyTo,
  } = useChatStore(
    useShallow((state) => ({
      messages:
        state.activeChatId === conversationId
          ? state.messages
          : EMPTY_ARRAY,

      chat: state.conversations.find(
        (item) => item.id === conversationId
      ),

      loading:
        state.activeChatId === conversationId
          ? state.loading
          : false,

      error:
        state.activeChatId === conversationId
          ? state.error
          : null,

      replyTo:
        state.activeChatId === conversationId
          ? state.replyTo
          : null,
    }))
  );

  const isGroup = chat?.type === "group";
  const isPrivate = chat?.type === "private";

  const isBlockedByMe =
    isPrivate && chat?.is_blocked_by_me === true;

  const canSendMessages =
    chat?.can_send_messages === true;

  const messagingUnavailable =
    chat?.can_send_messages === false;

  const chatName = getChatName(chat);

  /* -------------------- MESSAGE DATA -------------------- */

  const replyMessages = useReplyMessages(
    conversationId,
    messages
  );

  const {
    reactionsByMessage,
    toggleReaction,
    reactionError,
  } = useMessageReactions(
    conversationId,
    userId,
    messages
  );

  const recipientReadAt = useReadReceipts(
    conversationId,
    userId,
    isPrivate
  );

  const recipientReadTime = recipientReadAt
    ? Date.parse(recipientReadAt)
    : 0;

  const {
    typingUsers,
    notifyTyping,
    stopTyping,
  } = useTypingIndicator(
    conversationId,
    userId,
    { enabled: canSendMessages }
  );

  const profiles = useGroupProfiles({
    isGroup,
    messages,
    replyMessages,
    typingUsers,
    userId,
  });

  /* -------------------- SENDER NAMES -------------------- */

  const getSenderName = useCallback(
    (message) => {
      if (!message) return "Member";

      if (message.sender_id === userId) {
        return "You";
      }

      return isGroup
        ? getProfileName(profiles[message.sender_id])
        : chatName;
    },
    [userId, isGroup, profiles, chatName]
  );

  const otherUserId = chat?.other_user_id;

  const typingNames = useMemo(() => {
    if (!typingUsers.length) return EMPTY_ARRAY;

    if (!isGroup) {
      return otherUserId &&
        typingUsers.includes(otherUserId)
        ? [chatName]
        : EMPTY_ARRAY;
    }

    return typingUsers.map((id) =>
      getProfileName(profiles[id])
    );
  }, [
    isGroup,
    otherUserId,
    chatName,
    typingUsers,
    profiles,
  ]);

  /* -------------------- CHAT LIFECYCLE -------------------- */

  useEffect(() => {
    if (!conversationId) return;

    void useChatStore.getState().openChat(conversationId);

    return () => {
      useChatStore.getState().closeChat(conversationId);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!messagingUnavailable) return;

    stopTyping();
    useChatStore.getState().clearReply();
  }, [messagingUnavailable, stopTyping]);

  /* -------------------- SCROLL MANAGEMENT -------------------- */

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;

    if (!container) return;

    shouldScrollRef.current =
      container.scrollHeight -
        container.scrollTop -
        container.clientHeight <=
      SCROLL_THRESHOLD;
  }, []);

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    const latestMessage = messages.at(-1);

    if (!container) return;

    if (!latestMessage) {
      previousMessageIdRef.current = null;
      shouldScrollRef.current = true;
      return;
    }

    const previousId = previousMessageIdRef.current;

    const initialLoad = previousId === null;

    const ownNewMessage =
      previousId !== latestMessage.id &&
      latestMessage.sender_id === userId;

    if (
      initialLoad ||
      ownNewMessage ||
      shouldScrollRef.current
    ) {
      scrollToBottom(container);
      shouldScrollRef.current = true;
    }

    previousMessageIdRef.current = latestMessage.id;
  }, [messages, userId]);

  useEffect(() => {
    const container = messagesContainerRef.current;

    if (
      !container ||
      typeof ResizeObserver === "undefined"
    ) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (shouldScrollRef.current) {
        scrollToBottom(container);
      }
    });

    observer.observe(container);

    // Also observe message content so loaded images,
    // GIFs and previews can preserve bottom alignment.

    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    }

    return () => observer.disconnect();
  }, []);

  const jumpToMessage = useCallback((messageId) => {
    const container = messagesContainerRef.current;

    const element = document.getElementById(
      `message-${messageId}`
    );

    if (!container || !element || !container.contains(element)) {
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
      element.animate?.(
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

  /* -------------------- RENDER -------------------- */

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-gray-950">
      <ConversationHeader
        conversationId={conversationId}
        userId={userId}
        chat={chat}
        chatName={chatName}
        isGroup={isGroup}
        isPrivate={isPrivate}
        isBlockedByMe={isBlockedByMe}
        messagingUnavailable={messagingUnavailable}
        messages={messages}
        onJumpToMessage={jumpToMessage}
      />

      <MessageList
        messages={messages}
        loading={loading}
        userId={userId}
        isGroup={isGroup}
        canSendMessages={canSendMessages}
        recipientReadTime={recipientReadTime}
        replyMessages={replyMessages}
        reactionsByMessage={reactionsByMessage}
        getSenderName={getSenderName}
        onJumpToMessage={jumpToMessage}
        onToggleReaction={toggleReaction}
        containerRef={messagesContainerRef}
        onScroll={handleScroll}
      />

      <div className="min-w-0 border-t border-gray-800 bg-gray-950">
        {error && (
          <p role="alert" className="px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {reactionError && (
          <p role="alert" className="px-4 py-2 text-sm text-red-400">
            {reactionError}
          </p>
        )}

        {canSendMessages ? (
          <>
            <TypingIndicator names={typingNames} />

            <MessageInput
              userId={userId}
              onTyping={notifyTyping}
              onStopTyping={stopTyping}
              replySenderName={getSenderName(replyTo)}
            />
          </>
        ) : (
          <BlockedComposer
            isBlockedByMe={isBlockedByMe}
            messagingUnavailable={messagingUnavailable}
          />
        )}
      </div>
    </div>
  );
}

export default function ChatWindow(props) {
  return (
    <ChatSession
      key={`${props.userId}:${props.conversationId}`}
      {...props}
    />
  );
}