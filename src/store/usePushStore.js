// src/store/usePushStore.js

import { create } from "zustand";

import {
  isPushSupported,
  restorePushNotifications,
  enablePushNotifications,
  disablePushNotifications,
} from "@/lib/pushClient";

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

const usePushStore = create((set, get) => {
  function runOperation({
    operation,
    onSuccess,
    fallback,
    busyKey = "loading",
    initialState = {},
  }) {
    const currentGeneration = generation;

    const isCurrent = () =>
      currentGeneration === generation;

    let resolveOperation;
    let rejectOperation;

    const operationResult = new Promise((resolve, reject) => {
      resolveOperation = resolve;
      rejectOperation = reject;
    });

    const request = operationResult
      .then((result) => {
        if (!isCurrent()) return false;

        set({
          ...onSuccess(result),
          initialized: true,
        });

        return true;
      })
      .catch((error) => {
        if (isCurrent()) {
          set({
            error: error?.message || fallback,
          });
        }

        return false;
      })
      .finally(() => {
        if (activeRequest === request) {
          activeRequest = null;
        }

        if (isCurrent()) {
          set({ [busyKey]: false });
        }
      });

    // Register before notifying store subscribers.
    activeRequest = request;

    set({
      ...initialState,
      [busyKey]: true,
      error: null,
      warning: null,
    });

    try {
      if (!isCurrent() || get().signingOut) {
        throw new Error("Notification operation cancelled");
      }

      // Execute synchronously to preserve browser
      // user activation when requesting permission.
      resolveOperation(operation());
    } catch (error) {
      rejectOperation(error);
    }

    return request;
  }

  function applyResult(result) {
    return {
      enabled: result.enabled,
      preference: result.preference,
    };
  }

  function canMutate() {
    const state = get();

    return (
      Boolean(state.userId) &&
      state.supported &&
      !state.checking &&
      !state.loading &&
      !state.signingOut &&
      !activeRequest
    );
  }

  function initialize(userId, { force = false } = {}) {
    const state = get();

    if (!userId || state.signingOut) {
      return Promise.resolve(false);
    }

    if (activeRequest) {
      if (state.userId === userId) {
        return activeRequest;
      }

      const currentGeneration = generation;

      return activeRequest.then(() => {
        if (
          generation !== currentGeneration ||
          get().signingOut
        ) {
          return false;
        }

        return initialize(userId, { force });
      });
    }

    if (
      !force &&
      state.initialized &&
      state.userId === userId
    ) {
      return Promise.resolve(true);
    }

    generation++;

    const supported = isPushSupported();

    if (!supported) {
      set({
        ...INITIAL_STATE,
        userId,
        initialized: true,
      });

      return Promise.resolve(true);
    }

    return runOperation({
      operation: () => restorePushNotifications(userId),

      onSuccess: applyResult,

      fallback: "Failed to restore notifications",

      busyKey: "checking",

      initialState: {
        ...INITIAL_STATE,
        userId,
        supported: true,
      },
    });
  }

  function enable() {
    if (!canMutate()) {
      return Promise.resolve(false);
    }

    return runOperation({
      operation: enablePushNotifications,

      onSuccess: applyResult,

      fallback: "Failed to enable notifications",
    });
  }

  function disable() {
    if (!canMutate()) {
      return Promise.resolve(false);
    }

    const { userId } = get();

    return runOperation({
      operation: () => disablePushNotifications(userId),

      onSuccess: (result) => ({
        enabled: false,
        preference: false,
        warning: result.warning || null,
      }),

      fallback: "Failed to disable notifications",
    });
  }

  return {
    ...INITIAL_STATE,

    initialize,
    enable,
    disable,

    refresh: () =>
      initialize(get().userId, { force: true }),

    clearError: () => {
      set({
        error: null,
        warning: null,
      });
    },

    prepareForLogout: async () => {
      set({ signingOut: true });

      if (activeRequest) {
        await activeRequest;
      }
    },

    cancelLogout: () => {
      set({ signingOut: false });
    },

    reset: () => {
      generation++;

      set({ ...INITIAL_STATE });
    },
  };
});

export default usePushStore;