// src/components/messages/MessengerRealtime.jsx

"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeToPresence } from "@/lib/presence";
import useChatStore from "@/store/useChatStore";
import usePresenceStore from "@/store/usePresenceStore";

const supabase = createClient();

export default function MessengerRealtime({ userId }) {
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const setOnlineUsers = usePresenceStore((s) => s.setOnlineUsers);

  useEffect(() => {
    const unsubscribePresence = subscribeToPresence(userId, setOnlineUsers);

    const channel = supabase
      .channel(`message-list:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const conversations = useChatStore.getState().conversations;
          const belongsToUser = conversations.some((chat) => chat.id === payload.new.conversation_id);

          if (belongsToUser) {
            fetchConversations();
          }
        }
      )
      .subscribe();

    return () => {
      unsubscribePresence();
      supabase.removeChannel(channel);
      usePresenceStore.getState().reset();
    };
  }, [userId, fetchConversations, setOnlineUsers]);

  return null;
}
