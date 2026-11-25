// src/store/usePresenceStore.js

import { create } from "zustand";

const usePresenceStore = create((set, get) => ({
  onlineUsers: [],
  onlineUserSet: new Set(),

  setOnlineUsers: (users) => {
    const onlineUserSet = new Set(users);
    const previous = get().onlineUserSet;
    const unchanged = previous.size === onlineUserSet.size && [...onlineUserSet].every((id) => previous.has(id));

    if (unchanged) return;

    set({
      onlineUsers: [...onlineUserSet],
      onlineUserSet,
    });
  },

  reset: () => {
    if (get().onlineUserSet.size === 0) return;

    set({
      onlineUsers: [],
      onlineUserSet: new Set(),
    });
  },
}));

export default usePresenceStore;
