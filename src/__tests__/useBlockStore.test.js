// src/__tests__/useBlockStore.test.js

/** @jest-environment node */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
} from "@jest/globals";

/* -------------------- API MOCKS -------------------- */

const mockBlockUser = jest.fn();
const mockUnblockUser = jest.fn();
const mockGetBlockedUsers = jest.fn();

jest.doMock("@/lib/blocks", () => ({
  blockUser: mockBlockUser,
  unblockUser: mockUnblockUser,
  getBlockedUsers: mockGetBlockedUsers,
}));

/* -------------------- CHAT STORE MOCK -------------------- */

const mockFetchConversations = jest.fn();

let chatState;

const mockChatStore = {
  getState: () => chatState,

  setState: jest.fn((update) => {
    const nextState =
      typeof update === "function"
        ? update(chatState)
        : update;

    chatState = {
      ...chatState,
      ...nextState,
    };
  }),
};

jest.doMock("@/store/useChatStore", () => ({
  __esModule: true,
  default: mockChatStore,
}));

/* -------------------- PRESENCE STORE MOCK -------------------- */

const mockRestrictUser = jest.fn();
const mockInvalidateRestrictions = jest.fn();
const mockFetchRestrictedUsers = jest.fn();

const mockPresenceStore = {
  getState: () => ({
    restrictUser: mockRestrictUser,
    invalidateRestrictions: mockInvalidateRestrictions,
    fetchRestrictedUsers: mockFetchRestrictedUsers,
  }),
};

jest.doMock("@/store/usePresenceStore", () => ({
  __esModule: true,
  default: mockPresenceStore,
}));

/* -------------------- LOAD STORE -------------------- */

const useBlockStore =
  require("@/store/useBlockStore").default;

/* -------------------- TEST DATA -------------------- */

const USER_A =
  "11111111-1111-4111-8111-111111111111";

const USER_B =
  "22222222-2222-4222-8222-222222222222";

const USER_C =
  "33333333-3333-4333-8333-333333333333";

const CHAT_A =
  "44444444-4444-4444-8444-444444444444";

const CHAT_B =
  "55555555-5555-4555-8555-555555555555";

const GROUP_A =
  "66666666-6666-4666-8666-666666666666";

const BLOCKED_USER = {
  user_id: USER_B,
  username: "jamie",
  display_name: "Jamie Lee",
  avatar_url: null,
  blocked_at: "2026-11-26T00:00:00Z",
};

/* -------------------- HELPERS -------------------- */

function store() {
  return useBlockStore.getState();
}

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function getConversation(id) {
  return chatState.conversations.find(
    (conversation) => conversation.id === id
  );
}

/* -------------------- SETUP -------------------- */

beforeEach(() => {
  store().reset();

  jest.clearAllMocks();

  mockBlockUser.mockReset();
  mockUnblockUser.mockReset();
  mockGetBlockedUsers.mockReset();
  mockFetchConversations.mockReset();
  mockFetchRestrictedUsers.mockReset();

  mockBlockUser.mockResolvedValue(true);
  mockUnblockUser.mockResolvedValue(true);
  mockGetBlockedUsers.mockResolvedValue([]);
  mockFetchConversations.mockResolvedValue(true);
  mockFetchRestrictedUsers.mockResolvedValue(true);

  chatState = {
    conversations: [
      {
        id: CHAT_A,
        type: "private",
        other_user_id: USER_B,
        is_blocked_by_me: false,
        can_send_messages: true,
      },
      {
        id: CHAT_B,
        type: "private",
        other_user_id: USER_C,
        is_blocked_by_me: false,
        can_send_messages: true,
      },
      {
        id: GROUP_A,
        type: "group",
        is_blocked_by_me: false,
        can_send_messages: true,
      },
    ],

    activeChatId: CHAT_A,
    replyTo: null,

    fetchConversations: mockFetchConversations,
  };
});

/* -------------------- INITIAL STATE -------------------- */

describe("Initial state", () => {
  test("starts with an empty blocked users list", () => {
    expect(store().blockedUsers).toEqual([]);
  });

  test("starts without pending mutations", () => {
    expect(store().pendingUsers).toEqual({});
  });

  test("starts without loading or errors", () => {
    expect(store().loading).toBe(false);
    expect(store().loaded).toBe(false);
    expect(store().error).toBeNull();
    expect(store().lastFetchedAt).toBe(0);
  });
});

/* -------------------- FETCH BLOCKED USERS -------------------- */

describe("Fetching blocked users", () => {
  test("retrieves blocked users", async () => {
    mockGetBlockedUsers.mockResolvedValue([
      BLOCKED_USER,
    ]);

    const result = await store().fetchBlockedUsers();

    expect(result).toEqual([BLOCKED_USER]);

    expect(store().blockedUsers).toEqual([
      BLOCKED_USER,
    ]);

    expect(store().loaded).toBe(true);
    expect(store().loading).toBe(false);
  });

  test("handles an empty blocked users list", async () => {
    const result = await store().fetchBlockedUsers();

    expect(result).toEqual([]);
    expect(store().loaded).toBe(true);
  });

  test("sets loading while a request is pending", async () => {
    const request = deferred();

    mockGetBlockedUsers.mockReturnValue(
      request.promise
    );

    const result = store().fetchBlockedUsers();

    expect(store().loading).toBe(true);

    request.resolve([]);

    await result;

    expect(store().loading).toBe(false);
  });

  test("rejects invalid API responses", async () => {
    mockGetBlockedUsers.mockResolvedValue(null);

    await expect(
      store().fetchBlockedUsers()
    ).rejects.toThrow(
      "Invalid blocked users response"
    );

    expect(store().loading).toBe(false);
    expect(store().loaded).toBe(false);
  });

  test("handles database errors", async () => {
    mockGetBlockedUsers.mockRejectedValue(
      new Error("Database unavailable")
    );

    await expect(
      store().fetchBlockedUsers()
    ).rejects.toThrow("Database unavailable");

    expect(store().error).toBe(
      "Database unavailable"
    );

    expect(store().loading).toBe(false);
  });

  test("recovers after a failed request", async () => {
    mockGetBlockedUsers.mockRejectedValueOnce(
      new Error("Network error")
    );

    await expect(
      store().fetchBlockedUsers()
    ).rejects.toThrow("Network error");

    mockGetBlockedUsers.mockResolvedValue([
      BLOCKED_USER,
    ]);

    await store().fetchBlockedUsers();

    expect(store().error).toBeNull();
    expect(store().loaded).toBe(true);
  });
});

/* -------------------- CACHE -------------------- */

describe("Blocked users caching", () => {
  test("reuses a valid cached list", async () => {
    await store().fetchBlockedUsers();
    await store().fetchBlockedUsers();
    await store().fetchBlockedUsers();

    expect(
      mockGetBlockedUsers
    ).toHaveBeenCalledTimes(1);
  });

  test("supports forced refresh", async () => {
    await store().fetchBlockedUsers();

    await store().fetchBlockedUsers({
      force: true,
    });

    expect(
      mockGetBlockedUsers
    ).toHaveBeenCalledTimes(2);
  });

  test("refreshes an expired cache", async () => {
    await store().fetchBlockedUsers();

    useBlockStore.setState({
      lastFetchedAt: Date.now() - 61_000,
    });

    await store().fetchBlockedUsers();

    expect(
      mockGetBlockedUsers
    ).toHaveBeenCalledTimes(2);
  });

  test("supports manual cache invalidation", async () => {
    await store().fetchBlockedUsers();

    store().invalidateCache();

    expect(store().loaded).toBe(false);
    expect(store().lastFetchedAt).toBe(0);

    await store().fetchBlockedUsers();

    expect(
      mockGetBlockedUsers
    ).toHaveBeenCalledTimes(2);
  });

  test("deduplicates concurrent list requests", async () => {
    const request = deferred();

    mockGetBlockedUsers.mockReturnValue(
      request.promise
    );

    const first = store().fetchBlockedUsers();
    const second = store().fetchBlockedUsers();

    expect(first).toBe(second);

    request.resolve([]);

    await Promise.all([first, second]);

    expect(
      mockGetBlockedUsers
    ).toHaveBeenCalledTimes(1);
  });
});

/* -------------------- BLOCK USER -------------------- */

describe("Blocking users", () => {
  test("blocks a valid user", async () => {
    const result = await store().block(USER_B);

    expect(result).toBe(true);

    expect(mockBlockUser).toHaveBeenCalledWith(
      USER_B
    );
  });

  test("rejects invalid user IDs", async () => {
    await expect(
      store().block("invalid")
    ).rejects.toThrow("Invalid user ID");

    expect(mockBlockUser).not.toHaveBeenCalled();
  });

  test("tracks pending block operations", async () => {
    const request = deferred();

    mockBlockUser.mockReturnValue(
      request.promise
    );

    const operation = store().block(USER_B);

    expect(store().pendingUsers[USER_B]).toBe(
      "block"
    );

    request.resolve(true);

    await operation;

    expect(
      store().pendingUsers[USER_B]
    ).toBeUndefined();
  });

  test("invalidates the blocked users cache", async () => {
    await store().fetchBlockedUsers();

    await store().block(USER_B);

    expect(store().loaded).toBe(false);
    expect(store().lastFetchedAt).toBe(0);
  });

  test("does not automatically retrieve the blocked list", async () => {
    await store().block(USER_B);

    expect(
      mockGetBlockedUsers
    ).not.toHaveBeenCalled();
  });

  test("refreshes conversation summaries", async () => {
    await store().block(USER_B);

    expect(
      mockFetchConversations
    ).toHaveBeenCalledTimes(1);
  });

  test("handles failed block operations", async () => {
    mockBlockUser.mockRejectedValue(
      new Error("Block failed")
    );

    await expect(
      store().block(USER_B)
    ).rejects.toThrow("Block failed");

    expect(store().error).toBe("Block failed");
    expect(store().pendingUsers).toEqual({});
  });

  test("does not update local state when blocking fails", async () => {
    mockBlockUser.mockRejectedValue(
      new Error("Block failed")
    );

    await expect(
      store().block(USER_B)
    ).rejects.toThrow();

    expect(
      getConversation(CHAT_A).can_send_messages
    ).toBe(true);

    expect(
      mockRestrictUser
    ).not.toHaveBeenCalled();

    expect(
      mockFetchConversations
    ).not.toHaveBeenCalled();
  });
});

/* -------------------- CONVERSATION INTEGRATION -------------------- */

describe("Conversation integration", () => {
  test("disables messaging in the affected private chat", async () => {
    await store().block(USER_B);

    expect(getConversation(CHAT_A)).toMatchObject({
      is_blocked_by_me: true,
      can_send_messages: false,
    });
  });

  test("does not modify unrelated private chats", async () => {
    const previous = getConversation(CHAT_B);

    await store().block(USER_B);

    expect(getConversation(CHAT_B)).toBe(
      previous
    );
  });

  test("does not modify shared group chats", async () => {
    const previous = getConversation(GROUP_A);

    await store().block(USER_B);

    expect(getConversation(GROUP_A)).toBe(
      previous
    );

    expect(
      getConversation(GROUP_A).can_send_messages
    ).toBe(true);
  });

  test("clears an active reply when blocking", async () => {
    chatState.replyTo = {
      id: "message-1",
      content: "Hello",
    };

    await store().block(USER_B);

    expect(chatState.replyTo).toBeNull();
  });

  test("preserves replies in unrelated conversations", async () => {
    chatState.activeChatId = CHAT_B;

    const reply = {
      id: "message-2",
      content: "Hello",
    };

    chatState.replyTo = reply;

    await store().block(USER_B);

    expect(chatState.replyTo).toBe(reply);
  });

  test("keeps messaging disabled until unblock permissions refresh", async () => {
    await store().block(USER_B);

    await store().unblock(USER_B);

    expect(getConversation(CHAT_A)).toMatchObject({
      is_blocked_by_me: false,
      can_send_messages: false,
    });
  });
});

/* -------------------- PRESENCE INTEGRATION -------------------- */

describe("Presence integration", () => {
  test("immediately restricts presence after blocking", async () => {
    await store().block(USER_B);

    expect(
      mockRestrictUser
    ).toHaveBeenCalledWith(USER_B);
  });

  test("does not request a presence refresh after a normal block", async () => {
    await store().block(USER_B);

    expect(
      mockFetchRestrictedUsers
    ).not.toHaveBeenCalled();
  });

  test("invalidates presence restrictions after unblocking", async () => {
    await store().unblock(USER_B);

    expect(
      mockInvalidateRestrictions
    ).toHaveBeenCalledTimes(1);
  });

  test("forces an authoritative presence refresh after unblocking", async () => {
    await store().unblock(USER_B);

    expect(
      mockFetchRestrictedUsers
    ).toHaveBeenCalledWith({
      force: true,
    });
  });

  test("does not refresh presence after a failed unblock", async () => {
    mockUnblockUser.mockRejectedValue(
      new Error("Unblock failed")
    );

    await expect(
      store().unblock(USER_B)
    ).rejects.toThrow();

    expect(
      mockInvalidateRestrictions
    ).not.toHaveBeenCalled();

    expect(
      mockFetchRestrictedUsers
    ).not.toHaveBeenCalled();
  });
});

/* -------------------- UNBLOCK USER -------------------- */

describe("Unblocking users", () => {
  test("unblocks a valid user", async () => {
    const result = await store().unblock(USER_B);

    expect(result).toBe(true);

    expect(
      mockUnblockUser
    ).toHaveBeenCalledWith(USER_B);
  });

  test("rejects invalid user IDs", async () => {
    await expect(
      store().unblock(null)
    ).rejects.toThrow("Invalid user ID");

    expect(
      mockUnblockUser
    ).not.toHaveBeenCalled();
  });

  test("removes the user from the local blocked list", async () => {
    mockGetBlockedUsers.mockResolvedValue([
      BLOCKED_USER,
    ]);

    await store().fetchBlockedUsers();

    await store().unblock(USER_B);

    expect(store().blockedUsers).toEqual([]);
  });

  test("preserves other blocked users", async () => {
    const otherUser = {
      ...BLOCKED_USER,
      user_id: USER_C,
      username: "sam",
    };

    mockGetBlockedUsers.mockResolvedValue([
      BLOCKED_USER,
      otherUser,
    ]);

    await store().fetchBlockedUsers();

    await store().unblock(USER_B);

    expect(store().blockedUsers).toEqual([
      otherUser,
    ]);
  });

  test("tracks pending unblock operations", async () => {
    const request = deferred();

    mockUnblockUser.mockReturnValue(
      request.promise
    );

    const operation = store().unblock(USER_B);

    expect(store().pendingUsers[USER_B]).toBe(
      "unblock"
    );

    request.resolve(true);

    await operation;

    expect(store().pendingUsers).toEqual({});
  });

  test("handles failed unblock operations", async () => {
    mockUnblockUser.mockRejectedValue(
      new Error("Unblock failed")
    );

    await expect(
      store().unblock(USER_B)
    ).rejects.toThrow("Unblock failed");

    expect(store().error).toBe(
      "Unblock failed"
    );

    expect(store().pendingUsers).toEqual({});
  });
});

/* -------------------- MUTATION DEDUPLICATION -------------------- */

describe("Mutation deduplication", () => {
  test("deduplicates identical block operations", async () => {
    const request = deferred();

    mockBlockUser.mockReturnValue(
      request.promise
    );

    const first = store().block(USER_B);
    const second = store().block(USER_B);

    expect(first).toBe(second);

    request.resolve(true);

    await Promise.all([first, second]);

    expect(mockBlockUser).toHaveBeenCalledTimes(1);
  });

  test("deduplicates identical unblock operations", async () => {
    const request = deferred();

    mockUnblockUser.mockReturnValue(
      request.promise
    );

    const first = store().unblock(USER_B);
    const second = store().unblock(USER_B);

    expect(first).toBe(second);

    request.resolve(true);

    await Promise.all([first, second]);

    expect(
      mockUnblockUser
    ).toHaveBeenCalledTimes(1);
  });

  test("prevents unblocking during a pending block", async () => {
    const request = deferred();

    mockBlockUser.mockReturnValue(
      request.promise
    );

    const operation = store().block(USER_B);

    await expect(
      store().unblock(USER_B)
    ).rejects.toThrow(
      "A block operation is already in progress"
    );

    request.resolve(true);

    await operation;

    expect(
      mockUnblockUser
    ).not.toHaveBeenCalled();
  });

  test("prevents blocking during a pending unblock", async () => {
    const request = deferred();

    mockUnblockUser.mockReturnValue(
      request.promise
    );

    const operation = store().unblock(USER_B);

    await expect(
      store().block(USER_B)
    ).rejects.toThrow(
      "A block operation is already in progress"
    );

    request.resolve(true);

    await operation;

    expect(
      mockBlockUser
    ).not.toHaveBeenCalled();
  });

  test("allows concurrent operations for different users", async () => {
    await Promise.all([
      store().block(USER_B),
      store().block(USER_C),
    ]);

    expect(
      mockBlockUser
    ).toHaveBeenCalledTimes(2);

    expect(store().pendingUsers).toEqual({});
  });
});

/* -------------------- REFRESH FAILURES -------------------- */

describe("Conversation refresh failures", () => {
  test("preserves successful blocking when refresh returns false", async () => {
    mockFetchConversations.mockResolvedValue(
      false
    );

    const result = await store().block(USER_B);

    expect(result).toBe(true);

    expect(store().error).toContain(
      "conversations could not be refreshed"
    );

    expect(
      getConversation(CHAT_A).can_send_messages
    ).toBe(false);
  });

  test("preserves successful blocking when refresh throws", async () => {
    mockFetchConversations.mockRejectedValue(
      new Error("Network error")
    );

    const result = await store().block(USER_B);

    expect(result).toBe(true);

    expect(store().error).toContain(
      "conversations could not be refreshed"
    );
  });

  test("clears errors manually", async () => {
    mockBlockUser.mockRejectedValue(
      new Error("Block failed")
    );

    await expect(
      store().block(USER_B)
    ).rejects.toThrow();

    store().clearError();

    expect(store().error).toBeNull();
  });
});

/* -------------------- RACE CONDITIONS -------------------- */

describe("Asynchronous race conditions", () => {
  test("ignores a pending list response after reset", async () => {
    const request = deferred();

    mockGetBlockedUsers.mockReturnValue(
      request.promise
    );

    const operation = store().fetchBlockedUsers();

    await Promise.resolve();

    store().reset();

    request.resolve([BLOCKED_USER]);

    await operation;

    expect(store().blockedUsers).toEqual([]);
    expect(store().loaded).toBe(false);
  });

  test("ignores a completed block response after reset", async () => {
    const request = deferred();

    mockBlockUser.mockReturnValue(
      request.promise
    );

    const operation = store().block(USER_B);

    await Promise.resolve();

    store().reset();

    request.resolve(true);

    const result = await operation;

    expect(result).toBe(false);

    expect(
      mockRestrictUser
    ).not.toHaveBeenCalled();

    expect(
      mockFetchConversations
    ).not.toHaveBeenCalled();
  });

  test("ignores an outdated list response after blocking", async () => {
    const request = deferred();

    mockGetBlockedUsers.mockReturnValue(
      request.promise
    );

    const listOperation =
      store().fetchBlockedUsers();

    await Promise.resolve();

    await store().block(USER_B);

    request.resolve([BLOCKED_USER]);

    await listOperation;

    expect(store().loaded).toBe(false);
    expect(store().blockedUsers).toEqual([]);
  });

  test("ignores an outdated list response after unblocking", async () => {
    const request = deferred();

    mockGetBlockedUsers.mockReturnValue(
      request.promise
    );

    const listOperation =
      store().fetchBlockedUsers();

    await Promise.resolve();

    await store().unblock(USER_B);

    request.resolve([BLOCKED_USER]);

    await listOperation;

    expect(store().blockedUsers).toEqual([]);
  });

  test("allows new requests after resetting the store", async () => {
    const request = deferred();

    mockGetBlockedUsers.mockReturnValueOnce(
      request.promise
    );

    const previous = store().fetchBlockedUsers();

    await Promise.resolve();

    store().reset();

    mockGetBlockedUsers.mockResolvedValue([
      BLOCKED_USER,
    ]);

    await store().fetchBlockedUsers();

    request.resolve([]);

    await previous;

    expect(store().blockedUsers).toEqual([
      BLOCKED_USER,
    ]);

    expect(store().loaded).toBe(true);
  });
});

/* -------------------- RESET -------------------- */

describe("Store reset", () => {
  test("clears all cached state", async () => {
    mockGetBlockedUsers.mockResolvedValue([
      BLOCKED_USER,
    ]);

    await store().fetchBlockedUsers();

    store().reset();

    expect(store().blockedUsers).toEqual([]);
    expect(store().pendingUsers).toEqual({});
    expect(store().loading).toBe(false);
    expect(store().loaded).toBe(false);
    expect(store().error).toBeNull();
    expect(store().lastFetchedAt).toBe(0);
  });

  test("clears pending mutation state", async () => {
    const request = deferred();

    mockBlockUser.mockReturnValue(
      request.promise
    );

    const operation = store().block(USER_B);

    await Promise.resolve();

    store().reset();

    expect(store().pendingUsers).toEqual({});

    request.resolve(true);

    await operation;

    expect(store().pendingUsers).toEqual({});
  });
});