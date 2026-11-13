// src/components/messages/ChatList.jsx

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { MessageCircle, Users } from "lucide-react";

import useChatStore from "@/store/useChatStore";

export default function ChatList({ userId }) {
  const conversations = useChatStore((s) => s.conversations);
  const fetchConversations = useChatStore((s) => s.fetchConversations);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <aside className="flex h-full flex-col border-r border-gray-800 bg-gray-900">
      <header className="flex items-center justify-between border-b border-gray-800 p-5">
        <h2 className="flex items-center gap-2 text-xl font-bold text-white">
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

      <div className="flex-1 overflow-y-auto">
        {conversations.map((chat) => {
          const other = chat.members.find((member) => member?.id !== userId);

          return (
            <Link
              key={chat.id}
              href={`/messages/${chat.id}`}
              className="block border-b border-gray-800 p-4 hover:bg-gray-800"
            >
              <p className="font-semibold text-white">
                {other?.display_name ?? "Conversation"}
              </p>

              <p className="text-sm text-gray-400">
                @{other?.username ?? "unknown"}
              </p>
            </Link>
          );
        })}

        {conversations.length === 0 && (
          <p className="p-5 text-sm text-gray-400">
            No conversations yet.
          </p>
        )}
      </div>
    </aside>
  );
}
