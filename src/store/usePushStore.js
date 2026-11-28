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
  function runOperation(
    operation,
    {
      fallback,
      busyKey = "loading",
      initialState = {},
    }
  ) {
    const current = generation;

    let resolve;
    let reject;

    const result = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const request = result
      .then((value) => {
        if (current !== generation) {
          return false;
        }

        set({
          initialized: true,
          enabled: value.enabled === true,
          preference: value.preference === true,
          warning: value.warning || null,
        });

        return true;
      })
      .catch((error) => {
        if (current === generation) {
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

        if (current === generation) {
          set({ [busyKey]: false });
        }
      });

    activeRequest = request;

    set({
      ...initialState,
      [busyKey]: true,
      error: null,
      warning: null,
    });

    try {
      if (
        current !== generation ||
        get().signingOut
      ) {
        throw new Error(
          "Notification operation cancelled"
        );
      }

      // Preserve browser user activation.
      resolve(operation());
    } catch (error) {
      reject(error);
    }

    return request;
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

    if (
      state.userId &&
      state.userId !== userId
    ) {
      return Promise.resolve(false);
    }

    if (activeRequest) {
      return state.userId === userId
        ? activeRequest
        : Promise.resolve(false);
    }

    const sameUser = state.userId === userId;

    if (
      sameUser &&
      state.initialized &&
      !force
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

    return runOperation(
      () => restorePushNotifications(userId),
      {
        fallback: "Failed to restore notifications",
        busyKey: "checking",

        initialState: {
          ...(sameUser ? {} : INITIAL_STATE),
          userId,
          supported: true,
        },
      }
    );
  }

  function enable() {
    if (!canMutate()) {
      return Promise.resolve(false);
    }

    return runOperation(
      enablePushNotifications,
      {
        fallback: "Failed to enable notifications",
      }
    );
  }

  function disable() {
    if (!canMutate()) {
      return Promise.resolve(false);
    }

    const { userId } = get();

    return runOperation(
      () => disablePushNotifications(userId),
      {
        fallback: "Failed to disable notifications",
      }
    );
  }

  async function prepareForLogout() {
    set({ signingOut: true });

    if (activeRequest) {
      await activeRequest;
    }
  }

  return {
    ...INITIAL_STATE,

    initialize,
    enable,
    disable,
    prepareForLogout,

    refresh: () =>
      initialize(get().userId, { force: true }),

    clearError: () =>
      set({
        error: null,
        warning: null,
      }),

    cancelLogout: () =>
      set({ signingOut: false }),

    reset: () => {
      generation++;
      set({ ...INITIAL_STATE });
    },
  };
});

export default usePushStore;