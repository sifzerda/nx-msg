// src/components/ChatList.jsx

"use client";

import { memo, useEffect, useMemo } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  MessageCircle,
  Users,
  UsersRound,
} from "lucide-react";

import useChatStore from "@/store/useChatStore";
import usePresenceStore from "@/store/usePresenceStore";
import useCurrentDay from "@/hooks/useCurrentDay";

/* -------------------- DATE FORMATTERS -------------------- */

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

function formatTime(date, now) {
  if (!date) return "";

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  return value.toDateString() === now.toDateString()
    ? TIME_FORMATTER.format(value)
    : DATE_FORMATTER.format(value);
}

function getChatName(chat) {
  return chat.type === "group"
    ? chat.group_name || "Unnamed Group"
    : chat.other_display_name ||
        chat.other_username ||
        "Unknown user";
}

/* -------------------- PRESENCE -------------------- */

const PresenceDot = memo(function PresenceDot({
  userId,
}) {
  const online = usePresenceStore(
    (state) => state.onlineUserSet.has(userId)
  );

  return (
    <span
      title={online ? "Online" : "Offline"}
      className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-gray-900 ${
        online ? "bg-green-500" : "bg-gray-500"
      }`}
    />
  );
});

/* -------------------- CHAT LIST ITEM -------------------- */

const ChatListItem = memo(function ChatListItem({
  chat,
  active,
  now,
}) {
  const isGroup = chat.type === "group";
  const name = getChatName(chat);

  const unread = Math.max(
    0,
    Number(chat.unread_count) || 0
  );

  const timestamp =
    chat.last_message_at || chat.created_at;

  const time = useMemo(
    () => formatTime(timestamp, now),
    [timestamp, now]
  );

  return (
    <Link
      href={`/messages/${chat.id}`}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 border-b border-gray-800 p-4 transition ${
        active
          ? "bg-gray-800"
          : "hover:bg-gray-800/60"
      }`}
    >
      <div className="relative shrink-0">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full font-semibold ${
            isGroup
              ? "bg-blue-600/20 text-blue-400"
              : "bg-gray-700 text-white"
          }`}
        >
          {isGroup ? (
            <UsersRound size={24} />
          ) : (
            name[0]?.toUpperCase() || "?"
          )}
        </div>

        {!isGroup && (
          <PresenceDot userId={chat.other_user_id} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`truncate text-sm ${
              unread > 0
                ? "font-bold text-white"
                : "font-semibold text-gray-200"
            }`}
          >
            {name}
          </p>

          <time
            dateTime={timestamp || undefined}
            className="shrink-0 text-xs text-gray-500"
          >
            {time}
          </time>
        </div>

        {isGroup && (
          <p className="mt-0.5 text-xs text-gray-500">
            {chat.member_count} members
          </p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <p
            className={`truncate text-sm ${
              unread > 0
                ? "font-medium text-white"
                : "text-gray-400"
            }`}
          >
            {chat.last_message || "Start a conversation"}
          </p>

          {unread > 0 && (
            <span
              aria-label={`${unread} unread messages`}
              className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-bold text-white"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});

/* -------------------- HEADER -------------------- */

const ChatListHeader = memo(function ChatListHeader({
  creatingGroup,
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-gray-800 p-5">
      <h2 className="flex items-center gap-2 text-xl font-bold text-white">
        <MessageCircle size={22} />
        Chats
      </h2>

      <div className="flex items-center gap-1">
        <Link
          href="/messages/new"
          title="New Group"
          aria-label="New Group"
          className={`rounded-lg p-2 transition ${
            creatingGroup
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          }`}
        >
          <UsersRound size={20} />
        </Link>

        <Link
          href="/contacts"
          title="Contacts"
          aria-label="Contacts"
          className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
        >
          <Users size={20} />
        </Link>
      </div>
    </header>
  );
});

/* -------------------- EMPTY STATE -------------------- */

function EmptyChatList() {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <MessageCircle size={32} className="text-gray-600" />

      <p className="text-sm text-gray-400">
        No conversations yet.
      </p>

      <Link
        href="/contacts"
        className="text-sm text-blue-400 hover:text-blue-300"
      >
        Find contacts to start chatting
      </Link>
    </div>
  );
}

/* -------------------- CHAT LIST -------------------- */

export default function ChatList() {
  const pathname = usePathname();
  const now = useCurrentDay();

  const conversations = useChatStore(
    (state) => state.conversations
  );

  useEffect(() => {
    void useChatStore.getState().fetchConversations();
  }, []);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-gray-900">
      <ChatListHeader
        creatingGroup={pathname === "/messages/new"}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length ? (
          conversations.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              now={now}
              active={pathname === `/messages/${chat.id}`}
            />
          ))
        ) : (
          <EmptyChatList />
        )}
      </div>
    </aside>
  );
}