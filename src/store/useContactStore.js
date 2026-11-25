// src/store/useContactStore.js

import { create } from "zustand";

import {
  getContacts,
  addContact,
  removeContact,
} from "@/lib/contacts";

let generation = 0;
let contactRequest = null;
let refreshPending = false;

const useContactStore = create((set, get) => ({
  contacts: [],
  loading: false,
  error: null,

  fetchContacts: ({ force = false } = {}) => {
    if (contactRequest) {
      if (force) {
        refreshPending = true;
      }

      return contactRequest;
    }

    const currentGeneration = generation;

    set({
      loading: true,
      error: null,
    });

    const request = (async () => {
      try {
        do {
          refreshPending = false;

          const contacts = await getContacts();

          if (currentGeneration !== generation) {
            return;
          }

          set({ contacts });
        } while (refreshPending);
      } catch (error) {
        if (currentGeneration === generation) {
          set({ error: error.message });
        }
      } finally {
        if (currentGeneration === generation) {
          set({ loading: false });
        }
      }
    })();

    contactRequest = request;

    request.finally(() => {
      if (contactRequest === request) {
        contactRequest = null;
      }
    });

    return request;
  },

  add: async (contactId) => {
    const currentGeneration = generation;

    set({ error: null });

    try {
      await addContact(contactId);

      if (currentGeneration !== generation) {
        return false;
      }

      await get().fetchContacts({ force: true });

      return currentGeneration === generation;
    } catch (error) {
      if (currentGeneration === generation) {
        set({ error: error.message });
      }

      return false;
    }
  },

  remove: async (contactId) => {
    const currentGeneration = generation;

    set({ error: null });

    try {
      await removeContact(contactId);

      if (currentGeneration !== generation) {
        return false;
      }

      await get().fetchContacts({ force: true });

      return currentGeneration === generation;
    } catch (error) {
      if (currentGeneration === generation) {
        set({ error: error.message });
      }

      return false;
    }
  },

  reset: () => {
    generation++;

    contactRequest = null;
    refreshPending = false;

    set({
      contacts: [],
      loading: false,
      error: null,
    });
  },
}));

export default useContactStore;
