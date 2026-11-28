// src/store/useContactStore.js

import { create } from "zustand";

import {
  getContacts,
  addContact,
  removeContact,
} from "@/lib/contacts";

const INITIAL_STATE = {
  contacts: [],
  loading: false,
  error: null,
};

let generation = 0;
let contactRequest = null;
let refreshPending = false;

const useContactStore = create((set, get) => {
  function fetchContacts({ force = false } = {}) {
    if (contactRequest) {
      refreshPending ||= force;
      return contactRequest;
    }

    const current = generation;

    const request = Promise.resolve().then(async () => {
      if (current !== generation) return false;

      try {
        do {
          refreshPending = false;

          const contacts = await getContacts();

          if (current !== generation) return false;

          set({ contacts });
        } while (refreshPending);

        return true;
      } catch (error) {
        if (current === generation) {
          set({
            error: error?.message || "Unable to load contacts.",
          });
        }

        return false;
      }
    }).finally(() => {
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

  async function mutateContact(contactId, operation) {
    const current = generation;

    set({ error: null });

    try {
      await operation(contactId);

      if (current !== generation) return false;

      await get().fetchContacts({ force: true });

      return current === generation;
    } catch (error) {
      if (current === generation) {
        set({
          error: error?.message || "Unable to update contact.",
        });
      }

      return false;
    }
  }

  return {
    ...INITIAL_STATE,

    fetchContacts,

    add: (contactId) =>
      mutateContact(contactId, addContact),

    remove: (contactId) =>
      mutateContact(contactId, removeContact),

    reset: () => {
      generation++;
      contactRequest = null;
      refreshPending = false;

      set({ ...INITIAL_STATE });
    },
  };
});

export default useContactStore;