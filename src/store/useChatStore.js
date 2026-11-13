// src/store/useChatStore.js

import { create } from "zustand";

import {
  getConversations,
  getMessages,
  sendMessage,
  markChatRead,
} from "@/lib/messages";

let chatRequestId = 0;

const mergeMessages = (existing, incoming) => {
  const unique = new Map();

  for (const message of [...existing, ...incoming]) {
    unique.set(message.id, message);
  }

  return [...unique.values()].sort(
    (a, b) =>
      new Date(a.created_at) - new Date(b.created_at) ||
      a.id.localeCompare(b.id)
  );
};

const useChatStore = create((set, get) => ({
  conversations: [],
  messages: [],
  activeChatId: null,
  loading: false,
  sending: false,
  error: null,

  fetchConversations: async () => {
    try {
      const conversations = await getConversations();
      set({ conversations, error: null });
    } catch (error) {
      set({ error: error.message });
    }
  },

  openChat: async (chatId) => {
    const requestId = ++chatRequestId;

    set({
      activeChatId: chatId,
      messages: [],
      loading: true,
      error: null,
    });

    try {
      const messages = await getMessages(chatId);

      if (
        requestId !== chatRequestId ||
        get().activeChatId !== chatId
      ) {
        return;
      }

      set((state) => ({
        messages: mergeMessages(state.messages, messages),
      }));

      await markChatRead(chatId);
      await get().fetchConversations();
    } catch (error) {
      if (requestId === chatRequestId) {
        set({ error: error.message });
      }
    } finally {
      if (requestId === chatRequestId) {
        set({ loading: false });
      }
    }
  },

  receiveMessage: (message) => {
    if (message.conversation_id !== get().activeChatId) {
      return;
    }

    set((state) => ({
      messages: mergeMessages(
        state.messages,
        [message]
      ),
    }));
  },

  markRead: async (chatId) => {
    try {
      await markChatRead(chatId);
      await get().fetchConversations();
    } catch (error) {
      set({ error: error.message });
    }
  },

  send: async (content) => {
    const chatId = get().activeChatId;

    if (!chatId || get().sending) return false;

    set({ sending: true, error: null });

    try {
      const message = await sendMessage(chatId, content);

      if (get().activeChatId === chatId) {
        get().receiveMessage(message);
      }

      await get().fetchConversations();

      return true;
    } catch (error) {
      set({ error: error.message });
      return false;
    } finally {
      set({ sending: false });
    }
  },

  reset: () => {
    ++chatRequestId;

    set({
      conversations: [],
      messages: [],
      activeChatId: null,
      loading: false,
      sending: false,
      error: null,
    });
  },
}));

export default useChatStore;
