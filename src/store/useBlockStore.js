// src/store/useBlockStore.js

import { create } from "zustand";
import { blockUser, unblockUser, getBlockedUsers } from "@/lib/blocks";
import useChatStore from "./useChatStore";
import usePresenceStore from "./usePresenceStore";

/* -------------------- CONSTANTS -------------------- */

const CACHE_TTL = 60_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -------------------- REQUEST TRACKING -------------------- */

let generation = 0;
let listVersion = 0;
let listRequest = null;

const pendingMutations = new Map();

/* -------------------- INITIAL STATE -------------------- */

const createInitialState = () => ({
    blockedUsers: [],
    pendingUsers: {},

    loading: false,
    loaded: false,
    error: null,

    lastFetchedAt: 0,
});

/* -------------------- HELPERS -------------------- */

function getErrorMessage(error, fallback) {
    return error?.message || fallback;
}

function invalidateList() {
    listVersion += 1;
    listRequest = null;
}

function isValidUserId(userId) {
    return (
        typeof userId === "string" && UUID_PATTERN.test(userId)
    );
}

/* -------------------- CONVERSATION SYNCHRONISATION -------------------- */

function updateConversationBlockStatus(userId, blocked) {
    useChatStore.setState((state) => {
        let changed = false;
        let clearReply = false;

        const conversations = state.conversations.map(
            (conversation) => {
                if (
                    conversation.type !== "private" ||
                    conversation.other_user_id !== userId
                ) {
                    return conversation;
                }

                if (
                    conversation.id === state.activeChatId &&
                    state.replyTo !== null
                ) {
                    clearReply = true;
                }

                if (
                    conversation.is_blocked_by_me === blocked &&
                    conversation.can_send_messages === false
                ) {
                    return conversation;
                }

                changed = true;

                return {
                    ...conversation,

                    is_blocked_by_me: blocked,

                    // Messaging remains disabled until
                    // authoritative permissions are refreshed.
                    can_send_messages: false,
                };
            }
        );

        if (!changed && !clearReply) {
            return state;
        }

        return {
            conversations: changed
                ? conversations
                : state.conversations,

            replyTo: clearReply
                ? null
                : state.replyTo,
        };
    });
}

/* -------------------- MUTATION HANDLER -------------------- */

function mutateBlock({
    userId,
    action,
    set,
}) {
    if (!isValidUserId(userId)) {
        return Promise.reject(
            new Error("Invalid user ID")
        );
    }

    const existing = pendingMutations.get(userId);

    if (existing) {
        // Reuse an identical operation.
        if (existing.action === action) {
            return existing.promise;
        }

        // Prevent overlapping block/unblock operations.
        return Promise.reject(
            new Error(
                "A block operation is already in progress"
            )
        );
    }

    const requestGeneration = generation;

    const isCurrentRequest = () => requestGeneration === generation;

    const request = Promise.resolve().then(async () => {
        try {
            if (!isCurrentRequest()) {
                return false;
            }

            /* -------------------- DATABASE MUTATION -------------------- */

            if (action === "block") {
                await blockUser(userId);
            } else {
                await unblockUser(userId);
            }

            if (!isCurrentRequest()) {
                return false;
            }

            /* -------------------- INVALIDATE LIST CACHE -------------------- */

            invalidateList();

            set((state) => ({
                lastFetchedAt: 0,
                loaded: false,
                loading: false,

                blockedUsers:
                    action === "unblock"
                        ? state.blockedUsers.filter(
                            (user) => user.user_id !== userId
                        )
                        : state.blockedUsers,
            }));

            /* -------------------- UPDATE LOCAL CONVERSATIONS -------------------- */

            updateConversationBlockStatus(userId, action === "block");

            /* -------------------- UPDATE LOCAL PRESENCE -------------------- */

            const presenceStore = usePresenceStore.getState();

            if (action === "block") {
                // Immediately hide the blocked user's presence.
                presenceStore.restrictUser(userId);
            } else {
                // Do not immediately expose presence.
                // The other user may still have us blocked.
                presenceStore.invalidateRestrictions();

                void presenceStore.fetchRestrictedUsers({
                    force: true,
                });
            }

            /* -------------------- REFRESH PERMISSIONS -------------------- */
            try {
                const refreshed = await useChatStore
                    .getState()
                    .fetchConversations();

                if (
                    refreshed !== true && isCurrentRequest()
                ) {
                    set({
                        error: "Block status updated, but conversations could not be refreshed.",
                    });
                }

            } catch (error) {
                if (isCurrentRequest()) {
                    set({
                        error:
                            "Block status updated, but conversations could not be refreshed.",
                    });
                }
            }

            // The database mutation succeeded even if
            // conversation synchronisation failed.

            return isCurrentRequest();

        } catch (error) {
            if (isCurrentRequest()) {
                set({
                    error: getErrorMessage(
                        error,
                        action === "block"
                            ? "Failed to block user"
                            : "Failed to unblock user"
                    ),
                });
            }

            throw error;

        } finally {
            if (isCurrentRequest()) {
                pendingMutations.delete(userId);

                set((state) => {
                    const pendingUsers = {
                        ...state.pendingUsers,
                    };

                    delete pendingUsers[userId];

                    return { pendingUsers };
                });
            }
        }
    });

    // Register the request before notifying subscribers.

    pendingMutations.set(userId, {
        action,
        promise: request,
    });

    set((state) => ({
        error: null,

        pendingUsers: {
            ...state.pendingUsers,
            [userId]: action,
        },
    }));

    return request;
}

/* -------------------- STORE -------------------- */

const useBlockStore = create((set, get) => ({

    ...createInitialState(),

    /* -------------------- FETCH BLOCKED USERS -------------------- */

    fetchBlockedUsers: ({ force = false } = {}) => {
        const state = get();

        const cacheValid =
            state.loaded &&
            Date.now() - state.lastFetchedAt < CACHE_TTL;

        // Reuse an existing request.

        if (listRequest) {
            return listRequest;
        }

        // Return cached users without a database request.

        if (!force && cacheValid) {
            return Promise.resolve(state.blockedUsers);
        }

        const requestGeneration = generation;
        const requestVersion = listVersion;

        const isCurrentRequest = () =>
            requestGeneration === generation &&
            requestVersion === listVersion;

        const request = Promise.resolve().then(async () => {
            try {
                if (!isCurrentRequest()) {
                    return [];
                }

                const users = await getBlockedUsers();

                if (!isCurrentRequest()) {
                    return [];
                }

                if (!Array.isArray(users)) {
                    throw new Error(
                        "Invalid blocked users response"
                    );
                }

                set({
                    blockedUsers: users,
                    loaded: true,
                    lastFetchedAt: Date.now(),
                });

                return users;

            } catch (error) {
                if (isCurrentRequest()) {
                    set({
                        error: getErrorMessage(
                            error,
                            "Failed to retrieve blocked users"
                        ),
                    });
                }

                throw error;

            } finally {
                if (isCurrentRequest()) {
                    listRequest = null;

                    set({
                        loading: false,
                    });
                }
            }
        });

        // Register before notifying subscribers.

        listRequest = request;

        set({
            loading: true,
            error: null,
        });

        return request;
    },

    /* -------------------- BLOCK -------------------- */

    block: (userId) =>
        mutateBlock({
            userId,
            action: "block",
            set,
        }),

    /* -------------------- UNBLOCK -------------------- */

    unblock: (userId) =>
        mutateBlock({
            userId,
            action: "unblock",
            set,
        }),

    /* -------------------- CLEAR ERROR -------------------- */

    clearError: () => {
        if (get().error !== null) {
            set({ error: null });
        }
    },

    /* -------------------- INVALIDATE CACHE -------------------- */

    invalidateCache: () => {
        invalidateList();

        set({
            loaded: false,
            loading: false,
            lastFetchedAt: 0,
        });
    },

    /* -------------------- RESET -------------------- */

    reset: () => {
        generation += 1;

        invalidateList();

        pendingMutations.clear();

        set(createInitialState());
    },
}));

export default useBlockStore;