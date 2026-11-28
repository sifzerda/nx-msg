// src/store/__tests__/usePresenceStore.test.js

/** @jest-environment node */

import { describe, test, expect, jest, beforeEach } from "@jest/globals";

/* -------------------- MOCKS -------------------- */

const mockGetRestrictedUserIds = jest.fn();

jest.doMock("@/lib/blocks", () => ({
    getRestrictedUserIds: mockGetRestrictedUserIds,
}));

const usePresenceStore = require("@/store/usePresenceStore").default;

/* -------------------- TEST USERS -------------------- */

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const USER_C = "33333333-3333-4333-8333-333333333333";
const USER_D = "44444444-4444-4444-8444-444444444444";

/* -------------------- HELPERS -------------------- */

function store() {
    return usePresenceStore.getState();
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

/* -------------------- SETUP -------------------- */

beforeEach(() => {
    store().reset();

    mockGetRestrictedUserIds.mockReset();
    mockGetRestrictedUserIds.mockResolvedValue([]);
});

/* -------------------- INITIAL STATE -------------------- */

describe("Initial state", () => {
    test("starts without an authenticated user", () => {
        expect(store().userId).toBeNull();
    });

    test("starts with empty presence sets", () => {
        expect(store().onlineUserSet).toEqual(new Set([]));
        expect(store().onlineUserSet.size).toBe(0);
        expect(store().rawOnlineUserSet.size).toBe(0);
        expect(store().restrictedUserSet.size).toBe(0);
    });

    test("restrictions are initially unloaded", () => {
        expect(store().restrictionsLoaded).toBe(false);
        expect(store().restrictionsLoading).toBe(false);
    });

    test("rejects invalid authenticated user IDs", async () => {
        const result = await store().initialize("invalid");

        expect(result).toBe(false);
        expect(store().userId).toBeNull();

        expect(
            mockGetRestrictedUserIds
        ).not.toHaveBeenCalled();
    });
});

/* -------------------- INITIALIZATION -------------------- */

describe("Initialization", () => {
    test("initializes the authenticated user", async () => {
        const result = await store().initialize(USER_A);

        expect(result).toBe(true);
        expect(store().userId).toBe(USER_A);
        expect(store().restrictionsLoaded).toBe(true);
    });

    test("retrieves restrictions during initialization", async () => {
        mockGetRestrictedUserIds.mockResolvedValue([
            USER_B,
            USER_C,
        ]);

        await store().initialize(USER_A);

        expect(store().restrictedUserSet).toEqual(new Set([USER_B, USER_C]));
        expect(mockGetRestrictedUserIds).toHaveBeenCalledTimes(1);
    });

    test("hides presence until restrictions are loaded", async () => {
        const request = deferred();

        mockGetRestrictedUserIds.mockReturnValue(request.promise);

        const initialization = store().initialize(USER_A);

        store().setOnlineUsers([USER_B, USER_C]);

        expect(store().rawOnlineUserSet.size).toBe(2);
        expect(store().onlineUserSet.size).toBe(0);

        request.resolve([USER_B]);

        await initialization;

        expect(store().onlineUserSet).toEqual(new Set([USER_C]));
    });
});

/* -------------------- PRESENCE FILTERING -------------------- */

describe("Presence filtering", () => {
    test("displays unrestricted online users", async () => {
        await store().initialize(USER_A);

        store().setOnlineUsers([
            USER_B,
            USER_C,
            USER_D,
        ]);

        expect(store().onlineUserSet).toEqual(new Set([
            USER_B,
            USER_C,
            USER_D,
        ]));
    });

    test("filters restricted users", async () => {
        mockGetRestrictedUserIds.mockResolvedValue([
            USER_B,
        ]);

        await store().initialize(USER_A);

        store().setOnlineUsers([
            USER_B,
            USER_C,
        ]);

        expect(store().onlineUserSet).toEqual(new Set([USER_C]));
        expect(store().onlineUserSet.has(USER_B)).toBe(false);
    });

    test("preserves raw presence internally", async () => {
        mockGetRestrictedUserIds.mockResolvedValue([
            USER_B,
        ]);

        await store().initialize(USER_A);

        store().setOnlineUsers([
            USER_B,
            USER_C,
        ]);

        expect(store().rawOnlineUserSet.has(USER_B)).toBe(true);
        expect(store().onlineUserSet.has(USER_B)).toBe(false);
    });

    test("filters multiple restricted users", async () => {
        mockGetRestrictedUserIds.mockResolvedValue([
            USER_B,
            USER_C,
        ]);

        await store().initialize(USER_A);

        store().setOnlineUsers([
            USER_B,
            USER_C,
            USER_D,
        ]);

        expect(store().onlineUserSet).toEqual(new Set([USER_D]));
    });

    test("removes duplicate online user IDs", async () => {
        await store().initialize(USER_A);

        store().setOnlineUsers([
            USER_B,
            USER_B,
            USER_C,
        ]);

        expect(store().onlineUserSet).toEqual(new Set([
            USER_B,
            USER_C,
        ]));
    });

    test("ignores invalid online user IDs", async () => {
        await store().initialize(USER_A);

        store().setOnlineUsers([
            USER_B,
            "invalid",
            null,
            undefined,
            123,
        ]);

        expect(store().onlineUserSet).toEqual(new Set([USER_B]));
    });

    test("handles empty presence updates", async () => {
        await store().initialize(USER_A);

        store().setOnlineUsers([USER_B]);
        store().setOnlineUsers([]);

        expect(store().onlineUserSet).toEqual(new Set([]));
        expect(store().onlineUserSet.size).toBe(0);
    });

    test("presence events do not trigger database requests", async () => {
        await store().initialize(USER_A);

        store().setOnlineUsers([USER_B]);
        store().setOnlineUsers([USER_B, USER_C]);
        store().setOnlineUsers([USER_C]);
        store().setOnlineUsers([]);

        expect(mockGetRestrictedUserIds).toHaveBeenCalledTimes(1);
    });
});

/* -------------------- BLOCKING -------------------- */

describe("Local blocking", () => {
    test("immediately hides a newly blocked user", async () => {
        await store().initialize(USER_A);

        store().setOnlineUsers([
            USER_B,
            USER_C,
        ]);

        store().restrictUser(USER_B);

        expect(store().onlineUserSet).toEqual(new Set([USER_C]));
        expect(store().restrictedUserSet.has(USER_B)).toBe(true);
    });

    test("blocking requires no additional RPC", async () => {
        await store().initialize(USER_A);

        store().restrictUser(USER_B);
        expect(mockGetRestrictedUserIds).toHaveBeenCalledTimes(1);
    });

    test("ignores invalid restriction IDs", async () => {
        await store().initialize(USER_A);

        store().restrictUser("invalid");
        expect(store().restrictedUserSet.size).toBe(0);
    });

    test("ignores restrictions without an authenticated user", () => {
        store().restrictUser(USER_B);
        expect(store().restrictedUserSet.size).toBe(0);
    });

    test("invalidates the restriction cache after blocking", async () => {
        await store().initialize(USER_A);

        expect(store().lastFetchedAt).toBeGreaterThan(0);
        store().restrictUser(USER_B);
        expect(store().lastFetchedAt).toBe(0);
    });
});

/* -------------------- UNBLOCKING -------------------- */

describe("Unblocking", () => {
    test("restores presence after authoritative refresh", async () => {
        mockGetRestrictedUserIds.mockResolvedValue([
            USER_B,
        ]);

        await store().initialize(USER_A);

        store().setOnlineUsers([USER_B]);
        expect(store().onlineUserSet).toEqual(new Set([]));

        mockGetRestrictedUserIds.mockResolvedValue([]);

        store().invalidateRestrictions();

        await store().fetchRestrictedUsers({
            force: true,
        });

        expect(store().onlineUserSet).toEqual(new Set([USER_B]));
    });

    test("preserves restrictions when a mutual block remains", async () => {
        mockGetRestrictedUserIds.mockResolvedValue([ USER_B ]);

        await store().initialize(USER_A);

        store().setOnlineUsers([USER_B]);
        store().invalidateRestrictions();

        await store().fetchRestrictedUsers({ force: true });

        expect(store().restrictedUserSet.has(USER_B)).toBe(true);
        expect(store().onlineUserSet).toEqual(new Set([]));
    });

    test("does not immediately expose presence on invalidation", async () => {
        mockGetRestrictedUserIds.mockResolvedValue([
            USER_B,
        ]);

        await store().initialize(USER_A);

        store().setOnlineUsers([USER_B]);
        store().invalidateRestrictions();
        expect(store().onlineUserSet).toEqual(new Set([]));
    });
});

/* -------------------- CACHING -------------------- */

describe("Restriction caching", () => {
    test("reuses a valid cached result", async () => {
        await store().initialize(USER_A);

        await store().fetchRestrictedUsers();
        await store().fetchRestrictedUsers();

        expect(mockGetRestrictedUserIds).toHaveBeenCalledTimes(1);
    });

    test("supports forced refresh", async () => {
        await store().initialize(USER_A);

        await store().fetchRestrictedUsers({
            force: true,
        });

        expect(mockGetRestrictedUserIds).toHaveBeenCalledTimes(2);
    });

    test("refreshes an invalidated cache", async () => {
        await store().initialize(USER_A);

        store().invalidateRestrictions();

        await store().fetchRestrictedUsers();

        expect(mockGetRestrictedUserIds).toHaveBeenCalledTimes(2);
    });

    test("refreshes an expired cache", async () => {
        await store().initialize(USER_A);

        usePresenceStore.setState({
            lastFetchedAt: Date.now() - 61_000,
        });

        await store().fetchRestrictedUsers();

        expect(mockGetRestrictedUserIds).toHaveBeenCalledTimes(2);
    });

    test("does not fetch without an authenticated user", async () => {
        const result = await store().fetchRestrictedUsers();

        expect(result).toBe(false);

        expect(mockGetRestrictedUserIds).not.toHaveBeenCalled();
    });
});

/* -------------------- REQUEST DEDUPLICATION -------------------- */

describe("Request deduplication", () => {
    test("reuses an existing pending request", async () => {
        const request = deferred();

        mockGetRestrictedUserIds.mockReturnValue(request.promise);

        const first = store().initialize(USER_A);
        const second = store().fetchRestrictedUsers();
        const third = store().fetchRestrictedUsers();

        expect(first).toBe(second);
        expect(second).toBe(third);

        request.resolve([]);

        await Promise.all([
            first,
            second,
            third,
        ]);

        expect(mockGetRestrictedUserIds).toHaveBeenCalledTimes(1);
    });
});

/* -------------------- ERROR HANDLING -------------------- */

describe("Error handling", () => {
    test("handles failed restriction requests", async () => {
        mockGetRestrictedUserIds.mockRejectedValue(new Error("Database unavailable"));

        const result = await store().initialize(USER_A);

        expect(result).toBe(false);

        expect(store().restrictionsError).toBe("Database unavailable");
        expect(store().restrictionsLoaded).toBe(false);
        expect(store().restrictionsLoading).toBe(false);
    });

    test("hides online status when a refresh fails", async () => {
        await store().initialize(USER_A);

        store().setOnlineUsers([USER_B]);

        mockGetRestrictedUserIds.mockRejectedValue(new Error("Network error"));

        await store().fetchRestrictedUsers({
            force: true,
        });

        expect(store().onlineUserSet).toEqual(new Set([]));
        expect(store().onlineUserSet.size).toBe(0);
    });

    test("rejects invalid restriction responses", async () => {
        mockGetRestrictedUserIds.mockResolvedValue(null);

        const result = await store().initialize(USER_A);

        expect(result).toBe(false);
        expect(store().restrictionsLoaded).toBe(false);
    });

    test("recovers after a successful retry", async () => {
        mockGetRestrictedUserIds.mockRejectedValue(new Error("Temporary failure"));

        await store().initialize(USER_A);
        store().setOnlineUsers([USER_B]);

        mockGetRestrictedUserIds.mockResolvedValue([]);

        const result = await store().fetchRestrictedUsers({
                force: true,
            });

        expect(result).toBe(true);
        expect(store().restrictionsError).toBeNull();
        expect(store().onlineUserSet).toEqual(new Set([USER_B]));
    });
});

/* -------------------- PERFORMANCE -------------------- */

describe("Reference stability", () => {
    test("preserves references for unchanged presence", async () => {
        await store().initialize(USER_A);

        store().setOnlineUsers([USER_B, USER_C]);

        const previousSet = store().onlineUserSet;

        store().setOnlineUsers([USER_B, USER_C]);

        expect(store().onlineUserSet).toBe(previousSet);
    });

    test("preserves visible references when only blocked presence changes", async () => {
        mockGetRestrictedUserIds.mockResolvedValue([
            USER_B,
        ]);

        await store().initialize(USER_A);

        store().setOnlineUsers([USER_C]);

        const previousSet = store().onlineUserSet;

        store().setOnlineUsers([USER_B, USER_C]);

        expect(store().onlineUserSet).toBe(previousSet);
    });

    test("preserves references when presence order changes", async () => {
        await store().initialize(USER_A);

        store().setOnlineUsers([USER_B, USER_C]);

        const previousSet = store().onlineUserSet;

        store().setOnlineUsers([USER_C, USER_B]);
        expect(store().onlineUserSet).toBe(previousSet);
    });
});

/* -------------------- RACE CONDITIONS -------------------- */

describe("Asynchronous race conditions", () => {
    test("ignores a pending response after logout", async () => {
        const request = deferred();

        mockGetRestrictedUserIds.mockReturnValue(request.promise);

        const initialization = store().initialize(USER_A);

        await Promise.resolve();

        store().reset();

        request.resolve([USER_B]);

        await initialization;

        expect(store().userId).toBeNull();
        expect(store().restrictedUserSet.size).toBe(0);
        expect(store().restrictionsLoaded).toBe(false);
    });

    test("ignores responses belonging to a previous account", async () => {
        const oldRequest = deferred();

        mockGetRestrictedUserIds.mockReturnValueOnce(oldRequest.promise);

        const firstInitialization = store().initialize(USER_A);

        await Promise.resolve();

        mockGetRestrictedUserIds.mockResolvedValueOnce([
            USER_D,
        ]);

        await store().initialize(USER_C);

        oldRequest.resolve([USER_B]);

        await firstInitialization;

        expect(store().userId).toBe(USER_C);
        expect(store().restrictedUserSet).toEqual(new Set([USER_D]));
    });

    test("prevents a stale response from undoing a new block", async () => {
        await store().initialize(USER_A);

        store().setOnlineUsers([USER_B]);

        const request = deferred();

        mockGetRestrictedUserIds.mockReturnValue(request.promise);

        const refresh = store().fetchRestrictedUsers({
                force: true,
            });

        await Promise.resolve();

        store().restrictUser(USER_B);

        request.resolve([]);

        await refresh;

        expect(store().restrictedUserSet.has(USER_B)).toBe(true);
        expect(store().onlineUserSet).toEqual(new Set([]));
    });
});

/* -------------------- CLEANUP -------------------- */

describe("Cleanup", () => {
    test("clears online presence while preserving restrictions", async () => {
        mockGetRestrictedUserIds.mockResolvedValue([
            USER_B,
        ]);

        await store().initialize(USER_A);

        store().setOnlineUsers([USER_C]);

        store().clearOnlineUsers();

        expect(store().onlineUserSet).toEqual(new Set([]));
        expect(store().rawOnlineUserSet.size).toBe(0);
        expect(store().restrictedUserSet.has(USER_B)).toBe(true);
        expect(store().restrictionsLoaded).toBe(true);
    });

    test("reset clears all account-specific data", async () => {
        mockGetRestrictedUserIds.mockResolvedValue([
            USER_B,
        ]);

        await store().initialize(USER_A);

        store().setOnlineUsers([USER_C]);

        store().reset();

        expect(store().userId).toBeNull();
        expect(store().onlineUserSet).toEqual(new Set([]));
        expect(store().onlineUserSet.size).toBe(0);
        expect(store().rawOnlineUserSet.size).toBe(0);
        expect(store().restrictedUserSet.size).toBe(0);
        expect(store().restrictionsLoaded).toBe(false);
        expect(store().restrictionsLoading).toBe(false);
        expect(store().restrictionsError).toBeNull();
        expect(store().lastFetchedAt).toBe(0);
    });
});
