// src/store/useContactStore.js

import { create } from "zustand";

import {
  getContacts,
  addContact,
  removeContact,
} from "@/lib/contacts";

const useContactStore = create((set, get) => ({
  contacts: [],
  loading: false,
  error: null,

  fetchContacts: async () => {
    set({ loading: true, error: null });

    try {
      const contacts = await getContacts();
      set({ contacts });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  add: async (contactId) => {
    set({ error: null });

    try {
      await addContact(contactId);
      await get().fetchContacts();
      return true;
    } catch (error) {
      set({ error: error.message });
      return false;
    }
  },

  remove: async (contactId) => {
    set({ error: null });

    try {
      await removeContact(contactId);
      await get().fetchContacts();
      return true;
    } catch (error) {
      set({ error: error.message });
      return false;
    }
  },

  reset: () => {
    set({
      contacts: [],
      loading: false,
      error: null,
    });
  },
}));

export default useContactStore;

