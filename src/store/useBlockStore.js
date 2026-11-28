// src/store/useBlockStore.js

import { create } from "zustand";
import { blockUser, unblockUser, getBlockedUsers } from "@/lib/blocks";
import useChatStore from "./useChatStore";
import usePresenceStore from "./usePresenceStore";
import { isUuid } from "@/utils/validation";

const CACHE_TTL = 60_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFRESH_ERROR = "Block status updated, but conversations could not be refreshed.";

const EMPTY_CACHE = {
    loaded: false,
    loading: false,
    lastFetchedAt: 0,
};

const createInitialState = () => ({
    ...EMPTY_CACHE,
    blockedUsers: [],
    pendingUsers: {},
    error: null,
});

let generation = 0;
let listVersion = 0;
let listRequest = null;

const pendingMutations = new Map();

function invalidateList() {
    listVersion++;
    listRequest = null;
}

function updateConversationBlockStatus(userId, blocked) {
    useChatStore.setState((state) => {
        let changed = false;
        let clearReply = false;

        const conversations = state.conversations.map((chat) => {
            if (
                chat.type !== "private" ||
                chat.other_user_id !== userId
            ) {
                return chat;
            }

            if (chat.id === state.activeChatId && state.replyTo !== null) {
                clearReply = true;
            }

            if (
                chat.is_blocked_by_me === blocked &&
                chat.can_send_messages === false
            ) {
                return chat;
            }

            changed = true;

            return {
                ...chat,
                is_blocked_by_me: blocked,

                // Keep messaging disabled until permissions
                // have been refreshed from the server.
                can_send_messages: false,
            };
        });

        if (!changed && !clearReply) return state;

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

function updatePresenceRestrictions(userId, blocked) {
    const presence = usePresenceStore.getState();

    if (blocked) {
        presence.restrictUser(userId);
        return;
    }

    // Unblocking does not guarantee that the other
    // user has also removed their block.
    presence.invalidateRestrictions();

    void presence.fetchRestrictedUsers({ force: true });
}

const useBlockStore = create((set, get) => {
    function setError(error, fallback) {
        set({
            error: error?.message || fallback,
        });
    }

    function invalidateCache() {
        invalidateList();
        set({ ...EMPTY_CACHE });
    }

    function fetchBlockedUsers({ force = false } = {}) {
        if (listRequest) return listRequest;

        const state = get();

        if (
            !force &&
            state.loaded &&
            Date.now() - state.lastFetchedAt < CACHE_TTL
        ) {
            return Promise.resolve(state.blockedUsers);
        }

        const currentGeneration = generation;
        const currentVersion = listVersion;

        const isCurrent = () =>
            currentGeneration === generation &&
            currentVersion === listVersion;

        const request = Promise.resolve()
            .then(async () => {
                if (!isCurrent()) return [];

                const users = await getBlockedUsers();

                if (!isCurrent()) return [];

                if (!Array.isArray(users)) {
                    throw new Error("Invalid blocked users response");
                }

                set({
                    blockedUsers: users,
                    loaded: true,
                    lastFetchedAt: Date.now(),
                });

                return users;
            })
            .catch((error) => {
                if (isCurrent()) {
                    setError(error, "Failed to retrieve blocked users");
                }

                throw error;
            })
            .finally(() => {
                if (isCurrent()) {
                    listRequest = null;
                    set({ loading: false });
                }
            });

        listRequest = request;

        set({
            loading: true,
            error: null,
        });

        return request;
    }

    function mutateBlock(userId, action) {
        if (!isUuid(userId)) {
            return Promise.reject(
                new Error("Invalid user ID")
            );
        }

        const existing = pendingMutations.get(userId);

        if (existing) {
            return existing.action === action
                ? existing.promise
                : Promise.reject(
                    new Error("A block operation is already in progress")
                );
        }

        const blocked = action === "block";
        const operation = blocked ? blockUser : unblockUser;

        const currentGeneration = generation;

        const isCurrent = () =>
            currentGeneration === generation;

        const request = Promise.resolve()
            .then(async () => {
                if (!isCurrent()) return false;

                await operation(userId);

                if (!isCurrent()) return false;

                invalidateList();

                set((state) => ({
                    ...EMPTY_CACHE,

                    blockedUsers: blocked
                        ? state.blockedUsers
                        : state.blockedUsers.filter(
                            (user) => user.user_id !== userId
                        ),
                }));

                updateConversationBlockStatus(userId, blocked);
                updatePresenceRestrictions(userId, blocked);

                try {
                    const refreshed = await useChatStore
                        .getState()
                        .fetchConversations({ force: true });

                    if (refreshed !== true && isCurrent()) {
                        set({ error: REFRESH_ERROR });
                    }
                } catch {
                    if (isCurrent()) {
                        set({ error: REFRESH_ERROR });
                    }
                }

                return isCurrent();
            })
            .catch((error) => {
                if (isCurrent()) {
                    setError(error, `Failed to ${action} user`);
                }

                throw error;
            })
            .finally(() => {
                if (!isCurrent()) return;

                pendingMutations.delete(userId);

                set((state) => {
                    const pendingUsers = {
                        ...state.pendingUsers,
                    };

                    delete pendingUsers[userId];

                    return { pendingUsers };
                });
            });

        // Register before notifying Zustand subscribers.
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

    return {
        ...createInitialState(),

        fetchBlockedUsers,

        block: (userId) =>
            mutateBlock(userId, "block"),

        unblock: (userId) =>
            mutateBlock(userId, "unblock"),

        invalidateCache,

        clearError: () => {
            if (get().error !== null) {
                set({ error: null });
            }
        },

        reset: () => {
            generation++;

            invalidateList();

            pendingMutations.clear();

            set(createInitialState());
        },
    };
});

export default useBlockStore;