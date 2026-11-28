// src/components/MessengerLayout.jsx

"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import ChatList from "./ChatList";
import MessengerRealtime from "./MessengerRealtime";

export default function MessengerLayout({
  children,
  userId,
}) {
  const pathname = usePathname() ?? "";
  const inConversation = pathname.startsWith("/messages/");

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-hidden bg-gray-950 text-white">
      <MessengerRealtime userId={userId} />

      <aside
        aria-label="Conversations"
        className={`min-h-0 w-full shrink-0 overflow-hidden border-r border-gray-800 md:w-80 ${
          inConversation
            ? "hidden md:block"
            : "block"
        }`}
      >
        <ChatList />
      </aside>

      <section
        aria-label="Conversation content"
        className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
          inConversation
            ? "flex"
            : "hidden md:flex"
        }`}
      >
        {inConversation && (
          <Link
            href="/messages"
            prefetch={false}
            className="flex shrink-0 items-center gap-2 border-b border-gray-800 bg-gray-900 px-4 py-3 text-sm text-white md:hidden"
          >
            <ArrowLeft
              size={20}
              aria-hidden="true"
            />

            Back to chats
          </Link>
        )}

        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {children}
        </div>
      </section>
    </div>
  );
}