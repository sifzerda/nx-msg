// src/store/usePresenceStore.js

import { create } from "zustand";
import { getRestrictedUserIds } from "@/lib/blocks";

/* -------------------- CONSTANTS -------------------- */

const CACHE_TTL = 60_000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -------------------- REQUEST STATE -------------------- */

let generation = 0;
let restrictionVersion = 0;
let restrictionRequest = null;

/* -------------------- INITIAL STATE -------------------- */

function createInitialState() {
  return {
    userId: null,

    rawOnlineUserSet: new Set(),
    restrictedUserSet: new Set(),

    onlineUsers: [],
    onlineUserSet: new Set(),

    restrictionsLoaded: false,
    restrictionsLoading: false,
    restrictionsError: null,

    lastFetchedAt: 0,
  };
}

/* -------------------- HELPERS -------------------- */

function isValidUserId(userId) {
  return (
    typeof userId === "string" &&
    UUID_PATTERN.test(userId)
  );
}

function createUserSet(users) {
  if (!Array.isArray(users)) {
    return new Set();
  }

  return new Set(users.filter(isValidUserId));
}

function setsEqual(first, second) {
  if (first === second) return true;

  if (first.size !== second.size) {
    return false;
  }

  for (const value of first) {
    if (!second.has(value)) {
      return false;
    }
  }

  return true;
}

function filterOnlineUsers(
  rawUsers,
  restrictedUsers,
  restrictionsLoaded
) {
  const visibleUsers = new Set();

  // Do not expose presence before restrictions load.
  if (!restrictionsLoaded) {
    return visibleUsers;
  }

  for (const userId of rawUsers) {
    if (!restrictedUsers.has(userId)) {
      visibleUsers.add(userId);
    }
  }

  return visibleUsers;
}

function getVisiblePresence(
  state,
  rawUsers = state.rawOnlineUserSet,
  restrictedUsers = state.restrictedUserSet,
  restrictionsLoaded = state.restrictionsLoaded
) {
  const visibleUsers = filterOnlineUsers(
    rawUsers,
    restrictedUsers,
    restrictionsLoaded
  );

  // Preserve references to avoid unnecessary re-renders.
  if (setsEqual(state.onlineUserSet, visibleUsers)) {
    return {};
  }

  return {
    onlineUserSet: visibleUsers,
    onlineUsers: [...visibleUsers],
  };
}

/* -------------------- STORE -------------------- */

const usePresenceStore = create((set, get) => ({
  ...createInitialState(),

  /* -------------------- INITIALIZATION -------------------- */

  initialize: (userId) => {
    if (!isValidUserId(userId)) {
      return Promise.resolve(false);
    }

    if (get().userId !== userId) {
      get().reset();

      set({
        userId,
      });
    }

    return get().fetchRestrictedUsers();
  },

  /* -------------------- PRESENCE UPDATES -------------------- */

  setOnlineUsers: (users) => {
    const state = get();

    if (!state.userId) return;

    const rawOnlineUserSet = createUserSet(users);

    if (
      setsEqual(
        state.rawOnlineUserSet,
        rawOnlineUserSet
      )
    ) {
      return;
    }

    set({
      rawOnlineUserSet,

      ...getVisiblePresence(
        state,
        rawOnlineUserSet
      ),
    });
  },

  /* -------------------- RESTRICTION FETCHING -------------------- */

  fetchRestrictedUsers: ({ force = false } = {}) => {
    const state = get();

    if (!state.userId) {
      return Promise.resolve(false);
    }

    // Deduplicate concurrent requests.
    if (restrictionRequest) {
      return restrictionRequest;
    }

    const cacheValid =
      state.restrictionsLoaded &&
      state.lastFetchedAt > 0 &&
      Date.now() - state.lastFetchedAt < CACHE_TTL;

    if (!force && cacheValid) {
      return Promise.resolve(true);
    }

    const currentGeneration = generation;
    const currentVersion = restrictionVersion;
    const currentUserId = state.userId;

    function isCurrentRequest() {
      return (
        generation === currentGeneration &&
        restrictionVersion === currentVersion &&
        get().userId === currentUserId
      );
    }

    const request = Promise.resolve().then(async () => {
      try {
        if (!isCurrentRequest()) {
          return false;
        }

        const users = await getRestrictedUserIds();

        // Ignore outdated responses.
        if (!isCurrentRequest()) {
          return false;
        }

        if (!Array.isArray(users)) {
          throw new Error(
            "Invalid restricted users response"
          );
        }

        const currentState = get();

        const nextRestrictedUsers =
          createUserSet(users);

        const restrictedUserSet = setsEqual(
          currentState.restrictedUserSet,
          nextRestrictedUsers
        )
          ? currentState.restrictedUserSet
          : nextRestrictedUsers;

        set({
          restrictedUserSet,

          restrictionsLoaded: true,
          restrictionsError: null,

          lastFetchedAt: Date.now(),

          ...getVisiblePresence(
            currentState,
            currentState.rawOnlineUserSet,
            restrictedUserSet,
            true
          ),
        });

        return true;
      } catch (error) {
        if (!isCurrentRequest()) {
          return false;
        }

        const currentState = get();

        // Fail closed if restrictions cannot be verified.
        set({
          restrictionsLoaded: false,

          restrictionsError:
            error?.message ||
            "Failed to retrieve presence restrictions",

          lastFetchedAt: 0,

          ...getVisiblePresence(
            currentState,
            currentState.rawOnlineUserSet,
            currentState.restrictedUserSet,
            false
          ),
        });

        return false;
      } finally {
        if (restrictionRequest === request) {
          restrictionRequest = null;
        }

        if (isCurrentRequest()) {
          set({
            restrictionsLoading: false,
          });
        }
      }
    });

    restrictionRequest = request;

    set({
      restrictionsLoading: true,
      restrictionsError: null,
    });

    return request;
  },

  /* -------------------- LOCAL BLOCKING -------------------- */

  restrictUser: (userId) => {
    const state = get();

    if (
      !state.userId ||
      !isValidUserId(userId)
    ) {
      return;
    }

    // Prevent older responses from undoing this block.
    restrictionVersion += 1;
    restrictionRequest = null;

    const restrictedUserSet = new Set(
      state.restrictedUserSet
    );

    restrictedUserSet.add(userId);

    set({
      restrictedUserSet,

      restrictionsLoading: false,
      lastFetchedAt: 0,

      ...getVisiblePresence(
        state,
        state.rawOnlineUserSet,
        restrictedUserSet
      ),
    });

    // Recover if blocking interrupted initial loading.
    if (!state.restrictionsLoaded) {
      void get().fetchRestrictedUsers({
        force: true,
      });
    }
  },

  /* -------------------- CACHE INVALIDATION -------------------- */

  invalidateRestrictions: () => {
    restrictionVersion += 1;
    restrictionRequest = null;

    set({
      lastFetchedAt: 0,
      restrictionsLoading: false,
    });
  },

  /* -------------------- DISCONNECTION -------------------- */

  clearOnlineUsers: () => {
    const state = get();

    if (
      state.rawOnlineUserSet.size === 0 &&
      state.onlineUserSet.size === 0
    ) {
      return;
    }

    set({
      rawOnlineUserSet: new Set(),

      ...getVisiblePresence(
        state,
        new Set()
      ),
    });
  },

  /* -------------------- ACCOUNT RESET -------------------- */

  reset: () => {
    generation += 1;
    restrictionVersion += 1;

    restrictionRequest = null;

    set(createInitialState());
  },
}));

export default usePresenceStore;