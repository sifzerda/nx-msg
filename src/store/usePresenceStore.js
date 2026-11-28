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
  onlineUserSet: new Set(),

  restrictionsLoaded: false,
  restrictionsLoading: false,
  restrictionsError: null,

  lastFetchedAt: 0,
});

let requestVersion = 0;
let restrictionRequest = null;

function isValidUserId(id) {
  return typeof id === "string" && UUID_PATTERN.test(id);
}

function createUserSet(users) {
  return new Set(Array.isArray(users) ? users.filter(isValidUserId) : []
  );
}

function invalidateRequest() {
  requestVersion++;
  restrictionRequest = null;
}

const usePresenceStore = create((set, get) => {
  /* -------------------- STATE UPDATES -------------------- */

  function updatePresence(changes) {
    set((state) => {
      const next = { ...changes };

      const rawUsers = changes.rawOnlineUserSet ?? state.rawOnlineUserSet;
      const restrictedUsers = changes.restrictedUserSet ?? state.restrictedUserSet;
      const loaded = changes.restrictionsLoaded ?? state.restrictionsLoaded;
      const rawChanged = rawUsers !== state.rawOnlineUserSet && !shallow(rawUsers, state.rawOnlineUserSet);
      const restrictionsChanged = restrictedUsers !== state.restrictedUserSet && !shallow(restrictedUsers, state.restrictedUserSet);
      const loadedChanged = loaded !== state.restrictionsLoaded;

      if (!rawChanged) {
        delete next.rawOnlineUserSet;
      }

      if (!restrictionsChanged) {
        delete next.restrictedUserSet;
      }

      // Only recalculate visible users when the
      // underlying presence data actually changes.
      if (
        rawChanged || restrictionsChanged || loadedChanged
      ) {
        const visibleUsers = new Set();

        if (loaded) {
          for (const id of rawUsers) {
            if (!restrictedUsers.has(id)) {
              visibleUsers.add(id);
            }
          }
        }

        if (!shallow(visibleUsers, state.onlineUserSet)) {
          next.onlineUserSet = visibleUsers;
        }
      }

      return Object.entries(next).some(([key, value]) => !Object.is(state[key], value)
      )
        ? next
        : state;
    });
  }

  /* -------------------- RESTRICTIONS -------------------- */

  function fetchRestrictedUsers({ force = false } = {}) {
    const state = get();

    if (!state.userId) {
      return Promise.resolve(false);
    }

    if (restrictionRequest) {
      return restrictionRequest;
    }

    if (
      !force &&
      state.restrictionsLoaded &&
      state.lastFetchedAt > 0 &&
      Date.now() - state.lastFetchedAt < CACHE_TTL
    ) {
      return Promise.resolve(true);
    }

    const version = requestVersion;
    const userId = state.userId;

    const isCurrent = () =>
      version === requestVersion &&
      get().userId === userId;

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
          restrictionsLoading: false,
          restrictionsError: null,
          lastFetchedAt: Date.now(),
        });

        return true;
      })
      .catch((error) => {
        if (!isCurrent()) return false;

        updatePresence({
          restrictionsLoaded: false,
          restrictionsLoading: false,
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
      });

    restrictionRequest = request;

    set({
      restrictionsLoading: true,
      restrictionsError: null,
    });

    return request;
  }

  /* -------------------- BLOCKING -------------------- */

  function restrictUser(userId) {
    const state = get();

    if (
      !state.userId ||
      !isValidUserId(userId)
    ) {
      return;
    }

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

    if (!state.restrictionsLoaded) {
      void fetchRestrictedUsers({
        force: true,
      });
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

  /* -------------------- LIFECYCLE -------------------- */

  function reset() {
    invalidateRequest();

    set(createInitialState());
  }

  function initialize(userId) {
    if (!isValidUserId(userId)) {
      return Promise.resolve(false);
    }

    if (get().userId !== userId) {
      invalidateRequest();

      set({
        ...createInitialState(),
        userId,
      });
    }

    return fetchRestrictedUsers();
  }

  /* -------------------- ONLINE USERS -------------------- */

  function setOnlineUsers(users) {
    if (!get().userId) return;

    updatePresence({
      rawOnlineUserSet: createUserSet(users),
    });
  }

  function clearOnlineUsers() {
    if (get().rawOnlineUserSet.size === 0) {
      return;
    }

    updatePresence({
      rawOnlineUserSet: new Set(),
    });
  }

  return {
    ...createInitialState(),

    initialize,
    reset,

    setOnlineUsers,
    clearOnlineUsers,

    fetchRestrictedUsers,
    restrictUser,
    invalidateRestrictions,
  };
});

export default usePresenceStore;