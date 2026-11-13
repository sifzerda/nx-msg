// src/store/usePresenceStore.js

import { create } from "zustand";

const usePresenceStore = create((set) => ({
  onlineUsers: [],

  setOnlineUsers: (onlineUsers) =>
    set({ onlineUsers }),

  reset: () => set({ onlineUsers: [] }),
}));

export default usePresenceStore;

