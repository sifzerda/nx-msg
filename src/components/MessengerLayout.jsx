// src/components/messages/MessengerLayout.jsx

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
  const pathname = usePathname();

  const inConversation = pathname.startsWith("/messages/");

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-950 text-white">
      <MessengerRealtime userId={userId} />

      <div
        className={`w-full shrink-0 border-r border-gray-800 md:w-80 ${
          inConversation ? "hidden md:block" : "block"
        }`}
      >
        <ChatList />
      </div>

      <main
        className={`min-w-0 flex-1 ${
          inConversation ? "block" : "hidden md:block"
        }`}
      >
        <div className="flex h-full min-h-0 flex-col">
          {inConversation && (
            <Link
              href="/messages"
              className="flex shrink-0 items-center gap-2 border-b border-gray-800 bg-gray-900 px-4 py-3 text-sm text-white md:hidden"
            >
              <ArrowLeft size={20} />
              Back to chats
            </Link>
          )}

          <div className="min-h-0 flex-1">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
