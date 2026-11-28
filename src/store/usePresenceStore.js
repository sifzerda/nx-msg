// src/store/usePresenceStore.js

import { create } from "zustand";
import { shallow } from "zustand/shallow";

import { getRestrictedUserIds } from "@/lib/blocks";

const CACHE_TTL = 60_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createInitialState = () => ({
  userId: null,

  rawOnlineUserSet: new Set(),
  restrictedUserSet: new Set(),

  onlineUsers: [],
  onlineUserSet: new Set(),

  restrictionsLoaded: false,
  restrictionsLoading: false,
  restrictionsError: null,

  lastFetchedAt: 0,
});

let generation = 0;
let restrictionVersion = 0;
let restrictionRequest = null;

function isValidUserId(userId) {
  return (
    typeof userId === "string" &&
    UUID_PATTERN.test(userId)
  );
}

function createUserSet(users) {
  return new Set(
    Array.isArray(users)
      ? users.filter(isValidUserId)
      : []
  );
}

function invalidateRequest() {
  restrictionVersion++;
  restrictionRequest = null;
}

const usePresenceStore = create((set, get) => {
  /*
   * Apply presence changes and recalculate visible users
   * in one atomic Zustand update.
   */
  function updatePresence(changes) {
    set((state) => {
      const next = { ...changes };

      const rawUsers =
        changes.rawOnlineUserSet ?? state.rawOnlineUserSet;

      const restrictedUsers =
        changes.restrictedUserSet ?? state.restrictedUserSet;

      const loaded =
        changes.restrictionsLoaded ?? state.restrictionsLoaded;

      const visibleUsers = new Set();

      if (loaded) {
        for (const userId of rawUsers) {
          if (!restrictedUsers.has(userId)) {
            visibleUsers.add(userId);
          }
        }
      }

      // Preserve existing Set references where possible.
      if (shallow(rawUsers, state.rawOnlineUserSet)) {
        delete next.rawOnlineUserSet;
      }

      if (shallow(restrictedUsers, state.restrictedUserSet)) {
        delete next.restrictedUserSet;
      }

      // Avoid re-rendering presence consumers if the
      // visible online users have not changed.
      if (!shallow(visibleUsers, state.onlineUserSet)) {
        next.onlineUserSet = visibleUsers;
        next.onlineUsers = [...visibleUsers];
      }

      const changed = Object.entries(next).some(
        ([key, value]) => !Object.is(state[key], value)
      );

      return changed ? next : state;
    });
  }

  function fetchRestrictedUsers({ force = false } = {}) {
    const state = get();

    if (!state.userId) {
      return Promise.resolve(false);
    }

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

    const isCurrent = () =>
      generation === currentGeneration &&
      restrictionVersion === currentVersion &&
      get().userId === currentUserId;

    const request = Promise.resolve()
      .then(async () => {
        if (!isCurrent()) return false;

        const users = await getRestrictedUserIds();

        if (!isCurrent()) return false;

        if (
          !Array.isArray(users) ||
          !users.every(isValidUserId)
        ) {
          throw new Error(
            "Invalid restricted users response"
          );
        }

        updatePresence({
          restrictedUserSet: new Set(users),
          restrictionsLoaded: true,
          restrictionsError: null,
          lastFetchedAt: Date.now(),
        });

        return true;
      })
      .catch((error) => {
        if (!isCurrent()) return false;

        // Fail closed if restrictions cannot be verified.
        updatePresence({
          restrictionsLoaded: false,
          restrictionsError:
            error?.message ||
            "Failed to retrieve presence restrictions",
          lastFetchedAt: 0,
        });

        return false;
      })
      .finally(() => {
        if (restrictionRequest === request) {
          restrictionRequest = null;
        }

        if (isCurrent()) {
          set({ restrictionsLoading: false });
        }
      });

    restrictionRequest = request;

    set({
      restrictionsLoading: true,
      restrictionsError: null,
    });

    return request;
  }

  function restrictUser(userId) {
    const state = get();

    if (!state.userId || !isValidUserId(userId)) {
      return;
    }

    // Prevent an older response from undoing a new block.
    invalidateRequest();

    const restrictedUserSet = new Set(
      state.restrictedUserSet
    );

    restrictedUserSet.add(userId);

    updatePresence({
      restrictedUserSet,
      restrictionsLoading: false,
      lastFetchedAt: 0,
    });

    // Recover if blocking interrupted initial loading
    // or a restriction revalidation.
    if (!state.restrictionsLoaded) {
      void fetchRestrictedUsers({ force: true });
    }
  }

  function invalidateRestrictions() {
    invalidateRequest();

    updatePresence({
      restrictionsLoaded: false,
      restrictionsLoading: false,
      lastFetchedAt: 0,
    });
  }

  function reset() {
    generation++;
    invalidateRequest();

    set(createInitialState());
  }

  function initialize(userId) {
    if (!isValidUserId(userId)) {
      return Promise.resolve(false);
    }

    if (get().userId !== userId) {
      generation++;
      invalidateRequest();

      set({
        ...createInitialState(),
        userId,
      });
    }

    return fetchRestrictedUsers();
  }

  function setOnlineUsers(users) {
    const state = get();

    if (!state.userId) return;

    const rawOnlineUserSet = createUserSet(users);

    if (shallow(rawOnlineUserSet, state.rawOnlineUserSet)) {
      return;
    }

    updatePresence({ rawOnlineUserSet });
  }

  function clearOnlineUsers() {
    const state = get();

    if (
      state.rawOnlineUserSet.size === 0 &&
      state.onlineUserSet.size === 0
    ) {
      return;
    }

    updatePresence({
      rawOnlineUserSet: new Set(),
    });
  }

  return {
    ...createInitialState(),

    initialize,
    setOnlineUsers,
    fetchRestrictedUsers,
    restrictUser,
    invalidateRestrictions,
    clearOnlineUsers,
    reset,
  };
});

export default usePresenceStore;