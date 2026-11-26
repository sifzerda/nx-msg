// src/store/useChatStore.js

import { create } from "zustand";
import { uploadAttachment } from "@/lib/extras/attachments";
import { getConversations, getMessages, sendMessage, markChatRead } from "@/lib/messages";
import { isValidGifId } from "@/lib/gifs";

let generation = 0;
let chatRequestId = 0;
let conversationRequest = null;
let refreshPending = false;

const readRequests = new Map();

const INITIAL_STATE = {
  conversations: [],
  messages: [],
  activeChatId: null,
  loading: false,
  sending: false,
  error: null,
  replyTo: null,
};

function compareMessages(a, b) {
  return (
    Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id)
  );
}

function mergeMessages(existing, incoming) {
  const unique = new Map();

  for (const message of incoming) {
    unique.set(message.id, message);
  }

  // Preserve newer Realtime data.
  for (const message of existing) {
    unique.set(message.id, message);
  }

  return [...unique.values()].sort(compareMessages);
}

function insertMessage(messages, message) {
  if (messages.some((item) => item.id === message.id)) {
    return messages;
  }

  const last = messages[messages.length - 1];

  if (!last || compareMessages(last, message) <= 0) {
    return [...messages, message];
  }

  // Handle out-of-order Realtime events.
  const next = [...messages];

  let low = 0;
  let high = next.length;

  while (low < high) {
    const middle = (low + high) >>> 1;

    if (compareMessages(next[middle], message) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  next.splice(low, 0, message);

  return next;
}

function shallowEqual(a, b) {
  if (a === b) return true;

  const keys = Object.keys(a);

  return (
    keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]))
  );
}

function reconcileConversations(previous, incoming) {
  const previousById = new Map(previous.map((chat) => [chat.id, chat]));
  const next = incoming.map((chat) => {
    const existing = previousById.get(chat.id);

    return existing && shallowEqual(existing, chat)
      ? existing
      : chat;
  });

  const unchanged = previous.length === next.length && previous.every((chat, index) => chat === next[index]);

  return unchanged ? previous : next;
}

function isMessagingAllowed(state, chatId) {
  const conversation = state.conversations.find(
    (chat) => chat.id === chatId
  );

  return conversation?.can_send_messages === true;
}

const useChatStore = create((set, get) => ({
  ...INITIAL_STATE,

  fetchConversations: () => {
    if (conversationRequest) {
      refreshPending = true;
      return conversationRequest;
    }

    const currentGeneration = generation;

    const request = Promise.resolve().then(async () => {
      let success = false;

      do {
        refreshPending = false;

        try {
          const incoming = await getConversations();

          if (currentGeneration !== generation) {
            return false;
          }

          // A newer refresh has been requested.
          // Do not apply potentially stale permissions.
          if (refreshPending) {
            continue;
          }

          const current = get().conversations;

          const conversations = reconcileConversations(
            current,
            incoming
          );

          if (conversations !== current) {
            set({ conversations });
          }

          success = true;

        } catch (error) {
          if (currentGeneration !== generation) {
            return false;
          }

          success = false;

          set({
            error:
              error?.message ||
              "Failed to refresh conversations",
          });
        }

      } while (
        refreshPending &&
        currentGeneration === generation
      );

      return success && currentGeneration === generation;
    });

    conversationRequest = request;

    request.finally(() => {
      if (conversationRequest === request) {
        conversationRequest = null;
      }
    });

    return request;
  },

  openChat: async (chatId) => {
    const requestId = ++chatRequestId;
    const currentGeneration = generation;
    const isCurrent = () => currentGeneration === generation && requestId === chatRequestId && get().activeChatId === chatId;

    set({
      activeChatId: chatId,
      messages: [],
      loading: true,
      error: null,
      replyTo: null,
    });

    try {
      const messages = await getMessages(chatId);

      if (!isCurrent()) return;

      set((state) => ({
        messages: mergeMessages(
          state.messages,
          messages
        ),
        loading: false,
      }));

      await get().markRead(chatId);
    } catch (error) {
      if (isCurrent()) {
        set({ error: error.message });
      }
    } finally {
      if (isCurrent() && get().loading) {
        set({ loading: false });
      }
    }
  },

  syncMessages: async () => {
    const chatId = get().activeChatId;
    const currentGeneration = generation;
    const requestId = chatRequestId;

    if (!chatId) return;

    try {
      const incoming = await getMessages(chatId);

      if (
        currentGeneration !== generation || requestId !== chatRequestId || get().activeChatId !== chatId
      ) {
        return;
      }

      set((state) => {
        const messages = mergeMessages(state.messages, incoming);
        const unchanged = messages.length === state.messages.length && messages.every((message, index) => message === state.messages[index]);

        return unchanged ? state : { messages };
      });

      if (
        typeof document !== "undefined" && document.visibilityState === "visible"
      ) {
        void get().markRead(chatId);
      }
    } catch (error) {
      if (
        currentGeneration === generation && requestId === chatRequestId
      ) {
        console.error("Failed to synchronise messages:", error);
      }
    }
  },

  receiveMessage: (message) => {
    const state = get();

    if (
      !message?.id || message.conversation_id !== state.activeChatId
    ) {
      return;
    }

    const messages = insertMessage(state.messages, message);

    if (messages !== state.messages) {
      set({ messages });
    }
  },

  markRead: (chatId) => {
    if (!chatId) return Promise.resolve();

    const existing = readRequests.get(chatId);

    if (existing) {
      existing.pending = true;
      return existing.promise;
    }

    const currentGeneration = generation;
    const entry = { pending: false, promise: null };

    entry.promise = (async () => {
      try {
        do {
          entry.pending = false;

          await markChatRead(chatId);

          if (currentGeneration !== generation) return;
        } while (entry.pending);

        await get().fetchConversations();
      } catch (error) {
        if (currentGeneration === generation) {
          set({ error: error.message });
        }
      } finally {
        if (readRequests.get(chatId) === entry) {
          readRequests.delete(chatId);
        }
      }
    })();

    readRequests.set(chatId, entry);

    return entry.promise;
  },

  send: async (
    content,
    attachmentFile = null,
    userId = null,
    gifId = null
  ) => {
    const message = content.trim();

    const {
      activeChatId,
      sending,
      replyTo,
    } = get();

    if (
      !activeChatId ||
      sending ||
      (!message && !attachmentFile && !gifId)
    ) {
      return false;
    }

    // Check cached conversation permissions.
    if (!isMessagingAllowed(get(), activeChatId)) {
      set({
        error: "Messaging is unavailable in this conversation",
      });

      return false;
    }

    if (message.length > 5000) {
      set({ error: "Message is too long" });
      return false;
    }

    if (attachmentFile && gifId) {
      set({
        error: "Cannot send a GIF and a file together",
      });

      return false;
    }

    if (gifId !== null && !isValidGifId(gifId)) {
      set({ error: "Invalid GIF ID" });
      return false;
    }

    if (attachmentFile && !userId) {
      set({ error: "Missing user information" });
      return false;
    }

    const currentGeneration = generation;

    const replyToId =
      replyTo?.conversation_id === activeChatId
        ? replyTo.id
        : null;

    set({
      sending: true,
      error: null,
    });

    try {
      const attachment = attachmentFile
        ? await uploadAttachment({
          conversationId: activeChatId,
          userId,
          file: attachmentFile,
        })
        : null;

      if (generation !== currentGeneration) {
        return false;
      }

      // Permissions may have changed during upload.
      if (!isMessagingAllowed(get(), activeChatId)) {
        throw new Error(
          "Messaging is unavailable in this conversation"
        );
      }

      const result = await sendMessage(
        activeChatId,
        message,
        replyToId,
        attachment,
        gifId
      );

      if (generation !== currentGeneration) {
        return false;
      }

      get().receiveMessage(result);

      const current = get();

      if (
        current.activeChatId === activeChatId &&
        current.replyTo === replyTo
      ) {
        set({ replyTo: null });
      }

      void get().fetchConversations();

      return true;

    } catch (error) {
      if (generation === currentGeneration) {
        if (get().activeChatId === activeChatId) {
          set({
            error:
              error?.message ||
              "Failed to send message",
          });
        }

        // Refresh permissions if the database rejected
        // the message because of an access restriction.
        if (error?.code === "42501") {
          void get().fetchConversations();
        }
      }

      return false;

    } finally {
      if (generation === currentGeneration) {
        set({ sending: false });
      }
    }
  },

  closeChat: (chatId) => {
    if (get().activeChatId !== chatId) return;

    chatRequestId++;

    set({
      activeChatId: null,
      messages: [],
      loading: false,
      error: null,
      replyTo: null,
    });
  },

  reset: () => {
    generation++;
    chatRequestId++;

    conversationRequest = null;
    refreshPending = false;

    readRequests.clear();

    set({
      ...INITIAL_STATE,
      conversations: [],
      messages: [],
    });
  },

  setReplyTo: (message) => {
    if (!message) {
      set({ replyTo: null });
      return;
    }

    if (
      message.conversation_id !== get().activeChatId
    ) {
      return;
    }

    set({ replyTo: message });
  },

  clearReply: () => {
    if (get().replyTo !== null) {
      set({ replyTo: null });
    }
  },

}));

export default useChatStore;
