// src/components/messages/ChatList.jsx

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Users } from "lucide-react";

import useChatStore from "@/store/useChatStore";
import usePresenceStore from "@/store/usePresenceStore";

function formatTime(date) {
  if (!date) return "";

  const value = new Date(date);
  const now = new Date();

  if (value.toDateString() === now.toDateString()) {
    return value.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return value.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

export default function ChatList() {
  const pathname = usePathname();

  const conversations = useChatStore(
    (s) => s.conversations
  );

  const fetchConversations = useChatStore(
    (s) => s.fetchConversations
  );

  const onlineUsers = usePresenceStore(
    (s) => s.onlineUsers
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-gray-900">
      <header className="flex items-center justify-between border-b border-gray-800 p-5">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <MessageCircle size={22} />
          Chats
        </h2>

        <Link
          href="/contacts"
          aria-label="Contacts"
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <Users size={20} />
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.map((chat) => {
          const active = pathname === `/messages/${chat.id}`;

          const online = onlineUsers.includes(
            chat.other_user_id
          );

          const unread = Number(chat.unread_count || 0);

          return (
            <Link
              key={chat.id}
              href={`/messages/${chat.id}`}
              className={`flex items-center gap-3 border-b border-gray-800 p-4 transition ${
                active
                  ? "bg-gray-800"
                  : "hover:bg-gray-800/60"
              }`}
            >
              <div className="relative shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-700 font-semibold text-white">
                  {chat.other_display_name?.[0]?.toUpperCase() ?? "?"}
                </div>

                <span
                  title={online ? "Online" : "Offline"}
                  className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-gray-900 ${
                    online ? "bg-green-500" : "bg-gray-500"
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-white">
                    {chat.other_display_name ?? "Unknown user"}
                  </p>

                  <span className="shrink-0 text-xs text-gray-500">
                    {formatTime(chat.last_message_at)}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <p
                    className={`truncate text-sm ${
                      unread
                        ? "font-medium text-white"
                        : "text-gray-400"
                    }`}
                  >
                    {chat.last_message ?? "Start a conversation"}
                  </p>

                  {unread > 0 && (
                    <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}

        {conversations.length === 0 && (
          <p className="p-5 text-sm text-gray-400">
            No conversations yet. Visit Contacts to start one.
          </p>
        )}
      </div>
    </aside>
  );
}
