// src/store/useContactStore.js

import { create } from "zustand";
import { shallow } from "zustand/shallow";

import {
  getContacts,
  addContact,
  removeContact,
} from "@/lib/contacts";

const CACHE_TTL = 60_000;

const EMPTY_CONTACTS = Object.freeze([]);

const INITIAL_STATE = {
  contacts: EMPTY_CONTACTS,
  loading: false,
  error: null,
  lastFetchedAt: 0,
};

let generation = 0;
let contactRequest = null;
let mutationRequest = null;
let refreshPending = false;

/* -------------------- HELPERS -------------------- */

function isFresh(timestamp) {
  return (
    timestamp > 0 &&
    Date.now() - timestamp < CACHE_TTL
  );
}

function reconcileContacts(previous, incoming) {
  if (!incoming.length) {
    return EMPTY_CONTACTS;
  }

  const existing = new Map(
    previous.map((contact) => [
      contact.id,
      contact,
    ])
  );

  const next = incoming.map((contact) => {
    const current = existing.get(contact.id);

    return current && shallow(current, contact)
      ? current
      : contact;
  });

  const unchanged =
    previous.length === next.length &&
    next.every(
      (contact, index) => contact === previous[index]
    );

  return unchanged ? previous : next;
}

/* -------------------- STORE -------------------- */

const useContactStore = create((set, get) => {
  function fetchContacts({ force = false } = {}) {
    if (contactRequest) {
      refreshPending ||= force;
      return contactRequest;
    }

    const state = get();

    if (
      !force &&
      !state.error &&
      isFresh(state.lastFetchedAt)
    ) {
      return Promise.resolve(true);
    }

    const current = generation;

    const request = Promise.resolve()
      .then(async () => {
        if (current !== generation) {
          return false;
        }

        try {
          do {
            refreshPending = false;

            const contacts = await getContacts();

            if (current !== generation) {
              return false;
            }

            // A mutation completed during this request.
            // Retrieve the latest snapshot before publishing.

            if (refreshPending) {
              continue;
            }

            set((state) => ({
              contacts: reconcileContacts(
                state.contacts,
                contacts
              ),
              lastFetchedAt: Date.now(),
              error: null,
            }));
          } while (refreshPending);

          return true;
        } catch (error) {
          if (current === generation) {
            set({
              lastFetchedAt: 0,
              error:
                error?.message ||
                "Unable to load contacts.",
            });
          }

          return false;
        }
      })
      .finally(() => {
        if (contactRequest === request) {
          contactRequest = null;
          set({ loading: false });
        }
      });

    contactRequest = request;

    set({
      loading: true,
      error: null,
    });

    return request;
  }

  function mutateContact(contactId, operation) {
    if (!contactId) {
      set({ error: "Invalid contact." });
      return Promise.resolve(false);
    }

    if (mutationRequest) {
      if (
        mutationRequest.contactId === contactId &&
        mutationRequest.operation === operation
      ) {
        return mutationRequest.promise;
      }

      return Promise.resolve(false);
    }

    const current = generation;

    const entry = {
      contactId,
      operation,
      promise: null,
    };

    entry.promise = Promise.resolve()
      .then(async () => {
        if (current !== generation) {
          return false;
        }

        try {
          await operation(contactId);

          if (current !== generation) {
            return false;
          }

          set({ lastFetchedAt: 0 });

          const refreshed = await fetchContacts({
            force: true,
          });

          return (
            current === generation &&
            refreshed === true
          );
        } catch (error) {
          if (current === generation) {
            set({
              lastFetchedAt: 0,
              error:
                error?.message ||
                "Unable to update contact.",
            });
          }

          return false;
        }
      })
      .finally(() => {
        if (mutationRequest === entry) {
          mutationRequest = null;
        }
      });

    mutationRequest = entry;

    set({ error: null });

    return entry.promise;
  }

  function invalidate() {
    set({ lastFetchedAt: 0 });

    if (contactRequest) {
      refreshPending = true;
    }
  }

  function reset() {
    generation++;

    contactRequest = null;
    mutationRequest = null;
    refreshPending = false;

    set({ ...INITIAL_STATE });
  }

  return {
    ...INITIAL_STATE,

    fetchContacts,

    add: (contactId) =>
      mutateContact(contactId, addContact),

    remove: (contactId) =>
      mutateContact(contactId, removeContact),

    invalidate,
    reset,
  };
});

export default useContactStore;