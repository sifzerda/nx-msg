// src/store/useChatStore.js

import { create } from "zustand";
import { shallow } from "zustand/shallow";

import {
  getConversations,
  getMessages,
  sendMessage,
  markChatRead,
  validateMessage,
} from "@/lib/messages";

import { uploadAttachment } from "@/lib/extras/attachments";

/* -------------------- INITIAL STATE -------------------- */

const CHAT_STATE = {
  activeChatId: null,
  messages: [],
  loading: false,
  error: null,
  replyTo: null,
};

const INITIAL_STATE = {
  ...CHAT_STATE,
  conversations: [],
  sending: false,
};

/* -------------------- REQUEST MANAGEMENT -------------------- */

let generation = 0;
let chatRequestId = 0;
let conversationRequest = null;
let refreshPending = false;

const readRequests = new Map();

/* -------------------- MESSAGE HELPERS -------------------- */

function sameItems(a, b) {
  return (
    a.length === b.length &&
    a.every((item, index) => item === b[index])
  );
}

function compareMessages(a, b) {
  return (
    Date.parse(a.created_at) - Date.parse(b.created_at) ||
    a.id.localeCompare(b.id)
  );
}

function mergeMessages(existing, incoming) {
  const unique = new Map(
    incoming.map((message) => [message.id, message])
  );

  // Existing Realtime data takes precedence.
  for (const message of existing) {
    unique.set(message.id, message);
  }

  const next = [...unique.values()].sort(compareMessages);

  return sameItems(existing, next) ? existing : next;
}

function insertMessage(messages, message) {
  if (messages.some((item) => item.id === message.id)) {
    return messages;
  }

  const last = messages.at(-1);

  // Fast path for chronological messages.
  if (!last || compareMessages(last, message) <= 0) {
    return [...messages, message];
  }

  // Binary search for out-of-order messages.
  let low = 0;
  let high = messages.length;

  while (low < high) {
    const middle = (low + high) >>> 1;

    if (compareMessages(messages[middle], message) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const next = [...messages];

  next.splice(low, 0, message);

  return next;
}

/* -------------------- CONVERSATION HELPERS -------------------- */

function reconcileConversations(previous, incoming) {
  const byId = new Map(
    previous.map((chat) => [chat.id, chat])
  );

  const next = incoming.map((chat) => {
    const existing = byId.get(chat.id);

    return existing && shallow(existing, chat)
      ? existing
      : chat;
  });

  return sameItems(previous, next) ? previous : next;
}

function canSendMessage(state, chatId) {
  return state.conversations.some(
    (chat) =>
      chat.id === chatId &&
      chat.can_send_messages === true
  );
}

/* -------------------- STORE -------------------- */

const useChatStore = create((set, get) => {

  /* -------------------- INTERNAL HELPERS -------------------- */

  function createChatGuard(chatId) {
    const currentGeneration = generation;
    const requestId = chatRequestId;

    return () =>
      currentGeneration === generation &&
      requestId === chatRequestId &&
      get().activeChatId === chatId;
  }

  function updateMessages(incoming) {
    const current = get().messages;
    const messages = mergeMessages(current, incoming);

    if (messages !== current) {
      set({ messages });
    }
  }

  function setError(error, fallback) {
    set({
      error: error?.message || fallback,
    });
  }

  /* -------------------- CONVERSATIONS -------------------- */

  function fetchConversations() {
    if (conversationRequest) {
      refreshPending = true;
      return conversationRequest;
    }

    const currentGeneration = generation;

    const request = Promise.resolve()
      .then(async () => {
        let success = false;

        while (currentGeneration === generation) {
          refreshPending = false;

          try {
            const incoming = await getConversations();

            if (currentGeneration !== generation) {
              return false;
            }

            // A newer refresh may contain updated permissions.
            if (refreshPending) continue;

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

            setError(
              error,
              "Failed to refresh conversations"
            );
          }

          if (!refreshPending) break;
        }

        return success && currentGeneration === generation;
      })
      .finally(() => {
        if (conversationRequest === request) {
          conversationRequest = null;
        }
      });

    conversationRequest = request;

    return request;
  }

  /* -------------------- OPEN CHAT -------------------- */

  async function openChat(chatId) {
    chatRequestId++;

    const isCurrent = createChatGuard(chatId);

    set({
      ...CHAT_STATE,
      activeChatId: chatId,
      loading: true,
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
        setError(error, "Failed to load messages");
      }
    } finally {
      if (isCurrent() && get().loading) {
        set({ loading: false });
      }
    }
  }

  /* -------------------- SYNCHRONISE MESSAGES -------------------- */

  async function syncMessages() {
    const chatId = get().activeChatId;

    if (!chatId) return;

    const isCurrent = createChatGuard(chatId);

    try {
      const incoming = await getMessages(chatId);

      if (!isCurrent()) return;

      updateMessages(incoming);

      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        void get().markRead(chatId);
      }
    } catch (error) {
      if (isCurrent()) {
        console.error(
          "Failed to synchronise messages:",
          error
        );
      }
    }
  }

  /* -------------------- RECEIVE MESSAGE -------------------- */

  function receiveMessage(message) {
    const state = get();

    if (
      !message?.id ||
      message.conversation_id !== state.activeChatId
    ) {
      return;
    }

    const messages = insertMessage(
      state.messages,
      message
    );

    if (messages !== state.messages) {
      set({ messages });
    }
  }

  /* -------------------- READ RECEIPTS -------------------- */

  function markRead(chatId) {
    if (!chatId) return Promise.resolve();

    const existing = readRequests.get(chatId);

    if (existing) {
      existing.pending = true;
      return existing.promise;
    }

    const currentGeneration = generation;

    const entry = {
      pending: false,
      promise: null,
    };

    entry.promise = Promise.resolve()
      .then(async () => {
        while (currentGeneration === generation) {
          entry.pending = false;

          await markChatRead(chatId);

          if (currentGeneration !== generation) {
            return;
          }

          if (entry.pending) continue;

          await get().fetchConversations();

          if (!entry.pending) break;
        }
      })
      .catch((error) => {
        if (currentGeneration === generation) {
          setError(
            error,
            "Failed to mark messages as read"
          );
        }
      })
      .finally(() => {
        if (readRequests.get(chatId) === entry) {
          readRequests.delete(chatId);
        }
      });

    readRequests.set(chatId, entry);

    return entry.promise;
  }

  /* -------------------- SEND MESSAGE -------------------- */

  async function send(
    content,
    attachmentFile = null,
    userId = null,
    gifId = null
  ) {
    const state = get();

    const {
      activeChatId: chatId,
      sending,
      replyTo,
    } = state;

    if (!chatId || sending) {
      return false;
    }

    if (
      typeof content === "string" &&
      !content.trim() &&
      !attachmentFile &&
      !gifId
    ) {
      return false;
    }

    const unavailable =
      "Messaging is unavailable in this conversation";

    let message;

    // Validate before uploading any attachments.
    try {
      if (!canSendMessage(state, chatId)) {
        throw new Error(unavailable);
      }

      message = validateMessage(
        content,
        attachmentFile,
        gifId
      );

      if (attachmentFile && !userId) {
        throw new Error("Missing user information");
      }
    } catch (error) {
      setError(error, "Invalid message");

      return false;
    }

    const currentGeneration = generation;

    const replyToId =
      replyTo?.conversation_id === chatId
        ? replyTo.id
        : null;

    set({
      sending: true,
      error: null,
    });

    try {
      const attachment = attachmentFile
        ? await uploadAttachment({
            conversationId: chatId,
            userId,
            file: attachmentFile,
          })
        : null;

      // Ignore operations belonging to a previous session.
      if (currentGeneration !== generation) {
        return false;
      }

      // Permissions may have changed during the upload.
      if (!canSendMessage(get(), chatId)) {
        throw new Error(unavailable);
      }

      const result = await sendMessage(
        chatId,
        message,
        replyToId,
        attachment,
        gifId
      );

      if (currentGeneration !== generation) {
        return false;
      }

      get().receiveMessage(result);

      const current = get();

      // Do not clear a newly selected reply.
      if (
        current.activeChatId === chatId &&
        current.replyTo === replyTo &&
        current.replyTo !== null
      ) {
        set({ replyTo: null });
      }

      void get().fetchConversations();

      return true;
    } catch (error) {
      if (currentGeneration === generation) {
        if (get().activeChatId === chatId) {
          setError(error, "Failed to send message");
        }

        // Refresh permissions after an authorization failure.
        if (error?.code === "42501") {
          void get().fetchConversations();
        }
      }

      return false;
    } finally {
      if (currentGeneration === generation) {
        set({ sending: false });
      }
    }
  }

  /* -------------------- CLOSE CHAT -------------------- */

  function closeChat(chatId) {
    if (get().activeChatId !== chatId) return;

    chatRequestId++;

    set({ ...CHAT_STATE });
  }

  /* -------------------- REPLIES -------------------- */

  function setReplyTo(message) {
    if (
      message &&
      message.conversation_id !== get().activeChatId
    ) {
      return;
    }

    const replyTo = message ?? null;

    if (get().replyTo !== replyTo) {
      set({ replyTo });
    }
  }

  function clearReply() {
    if (get().replyTo !== null) {
      set({ replyTo: null });
    }
  }

  /* -------------------- RESET -------------------- */

  function reset() {
    generation++;
    chatRequestId++;

    conversationRequest = null;
    refreshPending = false;

    readRequests.clear();

    set({ ...INITIAL_STATE });
  }

  /* -------------------- PUBLIC INTERFACE -------------------- */

  return {
    ...INITIAL_STATE,

    fetchConversations,
    openChat,
    closeChat,
    syncMessages,
    receiveMessage,
    markRead,
    send,
    setReplyTo,
    clearReply,
    reset,
  };
});

export default useChatStore;