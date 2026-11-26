// src/store/usePushStore.js

import { create } from "zustand";

import {
    isPushSupported,
    restorePushNotifications,
    enablePushNotifications,
    disablePushNotifications,
} from "@/lib/pushClient";

/* -------------------- STATE -------------------- */

const INITIAL_STATE = {
    userId: null,

    supported: false,
    initialized: false,
    checking: false,
    loading: false,

    preference: false,
    enabled: false,

    error: null,
    warning: null,

    signingOut: false,
};

let generation = 0;
let activeRequest = null;

function getErrorMessage(error, fallback) {
    return error?.message || fallback;
}

/* -------------------- STORE -------------------- */

const usePushStore = create((set, get) => ({
    ...INITIAL_STATE,

    /* -------------------- INITIALIZE -------------------- */

    initialize: (userId, { force = false } = {}) => {
        if (!userId) {
            return Promise.resolve(false);
        }

        const state = get();

        if (state.signingOut) {
            return Promise.resolve(false);
        }

        if (activeRequest) {
            if (state.userId === userId) {
                return activeRequest;
            }

            return activeRequest.then(() =>
                get().initialize(userId, { force })
            );
        }

        if (
            !force &&
            state.initialized &&
            state.userId === userId
        ) {
            return Promise.resolve(true);
        }

        const currentGeneration = ++generation;

        const supported = isPushSupported();

        const isCurrent = () =>
            currentGeneration === generation;

        if (!supported) {
            set({
                ...INITIAL_STATE,
                userId,
                supported: false,
                initialized: true,
            });

            return Promise.resolve(true);
        }

        const request = Promise.resolve().then(async () => {
            try {
                if (!isCurrent()) return false;

                const result =
                    await restorePushNotifications(userId);

                if (!isCurrent()) return false;

                set({
                    preference: result.preference,
                    enabled: result.enabled,
                    initialized: true,
                });

                return true;

            } catch (error) {
                if (isCurrent()) {
                    set({
                        error: getErrorMessage(
                            error,
                            "Failed to restore notifications"
                        ),
                    });
                }

                return false;

            } finally {
                if (activeRequest === request) {
                    activeRequest = null;
                }

                if (isCurrent()) {
                    set({ checking: false });
                }
            }
        });

        activeRequest = request;

        set({
            ...INITIAL_STATE,
            userId,
            supported: true,
            checking: true,
        });

        return request;
    },

    /* -------------------- ENABLE -------------------- */

    enable: () => {
        const state = get();

        if (
            !state.userId ||
            !state.supported ||
            state.checking ||
            state.loading ||
            state.signingOut ||
            activeRequest
        ) {
            return Promise.resolve(false);
        }

        const currentGeneration = generation;

        const isCurrent = () =>
            currentGeneration === generation;

        set({
            loading: true,
            error: null,
            warning: null,
        });

        // Start directly from the click handler so that
        // notification permission retains user activation.
        const operation = enablePushNotifications();

        const request = operation
            .then((result) => {
                if (!isCurrent()) return false;

                set({
                    enabled: result.enabled,
                    preference: result.preference,
                    initialized: true,
                });

                return true;
            })
            .catch((error) => {
                if (isCurrent()) {
                    set({
                        error: getErrorMessage(
                            error,
                            "Failed to enable notifications"
                        ),
                    });
                }

                return false;
            })
            .finally(() => {
                if (activeRequest === request) {
                    activeRequest = null;
                }

                if (isCurrent()) {
                    set({ loading: false });
                }
            });

        activeRequest = request;

        return request;
    },

    /* -------------------- DISABLE -------------------- */

    disable: () => {
        const state = get();

        if (
            !state.userId ||
            !state.supported ||
            state.checking ||
            state.loading ||
            state.signingOut ||
            activeRequest
        ) {
            return Promise.resolve(false);
        }

        const currentGeneration = generation;

        const isCurrent = () =>
            currentGeneration === generation;

        const request = Promise.resolve()
            .then(() =>
                disablePushNotifications(state.userId)
            )
            .then((result) => {
                if (!isCurrent()) return false;

                set({
                    enabled: false,
                    preference: false,
                    warning: result.warning || null,
                    initialized: true,
                });

                return true;
            })
            .catch((error) => {
                if (isCurrent()) {
                    set({
                        error: getErrorMessage(
                            error,
                            "Failed to disable notifications"
                        ),
                    });
                }

                return false;
            })
            .finally(() => {
                if (activeRequest === request) {
                    activeRequest = null;
                }

                if (isCurrent()) {
                    set({ loading: false });
                }
            });

        activeRequest = request;

        set({
            loading: true,
            error: null,
            warning: null,
        });

        return request;
    },

    /* -------------------- REFRESH -------------------- */

    refresh: () => {
        const { userId } = get();

        return get().initialize(userId, {
            force: true,
        });
    },

    /* -------------------- ERRORS -------------------- */

    clearError: () => {
        set({
            error: null,
            warning: null,
        });
    },

    /* -------------------- LOGOUT -------------------- */

    prepareForLogout: async () => {
        set({ signingOut: true });

        if (activeRequest) {
            await activeRequest;
        }
    },

    cancelLogout: () => {
        set({ signingOut: false });
    },

    /* -------------------- RESET -------------------- */

    reset: () => {
        generation += 1;

        set({ ...INITIAL_STATE });
    },
}));

export default usePushStore;