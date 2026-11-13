// src/store/useChatStore.js

import { create } from "zustand";

import {
    getConversations,
    getMessages,
    sendMessage,
} from "@/lib/messages";

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
        set({
            activeChatId: chatId,
            messages: [],
            loading: true,
            error: null,
        });

        try {
            const messages = await getMessages(chatId);

            if (get().activeChatId === chatId) {

                set((state) => {
                    const combined = [...messages, ...state.messages];

                    const unique = Array.from(new Map(combined.map((message) => [message.id, message])).values());
                    unique.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                    return { messages: unique };
                });

            }
        } catch (error) {
            if (get().activeChatId === chatId) {
                set({ error: error.message });
            }
        } finally {
            if (get().activeChatId === chatId) {
                set({ loading: false });
            }
        }
    },

    receiveMessage: (message) => {
        if (message.conversation_id !== get().activeChatId) {
            return;
        }

        set((state) => {
            if (state.messages.some((m) => m.id === message.id)) {
                return state;
            }

            return {
                messages: [...state.messages, message].sort(
                    (a, b) =>
                        new Date(a.created_at) - new Date(b.created_at)
                ),
            };
        });
    },

    send: async (content) => {
        const chatId = get().activeChatId;
        if (!chatId || get().sending) return false;

        set({ sending: true, error: null });

        try {
            const message = await sendMessage(chatId, content);
            get().receiveMessage(message);
            return true;
        } catch (error) {
            set({ error: error.message });
            return false;
        } finally {
            set({ sending: false });
        }
    },

    reset: () => set({
        conversations: [],
        messages: [],
        activeChatId: null,
        loading: false,
        sending: false,
        error: null,
    }),
}));

export default useChatStore;
