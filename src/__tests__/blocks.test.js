// src/__tests__/blocks.test.js
/** @jest-environment node */

import {
    describe,
    test,
    expect,
    jest,
    beforeEach,
} from "@jest/globals";

/* -------------------- MOCK SUPABASE -------------------- */

const mockRpc = jest.fn();
const mockSupabase = { rpc: mockRpc };
const mockCreateClient = jest.fn(() => mockSupabase);

jest.doMock("@/lib/supabase/client", () => ({ createClient: mockCreateClient }));

/* -------------------- IMPORT SERVICE -------------------- */

const {
    blockUser,
    unblockUser,
    isUserBlocked,
    getBlockedUsers,
    canSendChatMessage,
} = require("@/lib/blocks");

/* -------------------- TEST CONSTANTS -------------------- */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CHAT_ID = "22222222-2222-4222-8222-222222222222";

/* -------------------- TEST SETUP -------------------- */

beforeEach(() => {
    jest.clearAllMocks();

    mockRpc.mockReset();
    mockCreateClient.mockReturnValue(mockSupabase);
});

/* -------------------- BLOCK USER -------------------- */

describe("blockUser", () => {
    test("blocks a user", async () => {
        mockRpc.mockResolvedValue({
            data: true,
            error: null,
        });

        await expect(blockUser(USER_ID)).resolves.toBe(true);

        expect(mockRpc).toHaveBeenCalledWith("block_user", { target_user_id: USER_ID });
    });

    test("rejects unsuccessful block operations", async () => {
        mockRpc.mockResolvedValue({
            data: false,
            error: null,
        });

        await expect(blockUser(USER_ID)).rejects.toThrow("Failed to block user");
    });

    test("propagates database errors", async () => {
        const error = new Error("Permission denied");

        mockRpc.mockResolvedValue({
            data: null,
            error,
        });

        await expect(blockUser(USER_ID)).rejects.toBe(error);
    });
});

/* -------------------- UNBLOCK USER -------------------- */

describe("unblockUser", () => {
    test("unblocks a user", async () => {
        mockRpc.mockResolvedValue({
            data: true,
            error: null,
        });

        await expect(unblockUser(USER_ID)).resolves.toBe(true);

        expect(mockRpc).toHaveBeenCalledWith(
            "unblock_user",
            {
                target_user_id: USER_ID,
            }
        );
    });

    test("rejects unsuccessful unblock operations", async () => {
        mockRpc.mockResolvedValue({
            data: false,
            error: null,
        });

        await expect(unblockUser(USER_ID)).rejects.toThrow("Failed to unblock user");
    });

    test("propagates database errors", async () => {
        const error = new Error("Permission denied");

        mockRpc.mockResolvedValue({
            data: null,
            error,
        });

        await expect(unblockUser(USER_ID)).rejects.toBe(error);
    });
});

/* -------------------- BLOCK STATUS -------------------- */

describe("isUserBlocked", () => {
    test.each([true, false])(
        "returns block status %s",
        async (blocked) => {
            mockRpc.mockResolvedValue({
                data: blocked,
                error: null,
            });

            await expect(isUserBlocked(USER_ID)).resolves.toBe(blocked);

            expect(mockRpc).toHaveBeenCalledWith(
                "is_user_blocked",
                {
                    target_user_id: USER_ID,
                }
            );
        }
    );

    test("propagates database errors", async () => {
        const error = new Error("Request failed");

        mockRpc.mockResolvedValue({
            data: null,
            error,
        });

        await expect(
            isUserBlocked(USER_ID)
        ).rejects.toBe(error);
    });
});

/* -------------------- BLOCKED USERS -------------------- */

describe("getBlockedUsers", () => {
    test("returns blocked user profiles", async () => {
        const users = [
            {
                user_id: USER_ID,
                username: "alex",
                display_name: "Alex",
                avatar_url: null,
                blocked_at: "2026-01-01T00:00:00Z",
            },
        ];

        mockRpc.mockResolvedValue({
            data: users,
            error: null,
        });

        await expect(
            getBlockedUsers()
        ).resolves.toEqual(users);

        expect(mockRpc).toHaveBeenCalledWith(
            "get_blocked_users",
            undefined
        );
    });

    test("returns an empty array for null data", async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: null,
        });

        await expect(
            getBlockedUsers()
        ).resolves.toEqual([]);
    });

    test("propagates database errors", async () => {
        const error = new Error("Request failed");

        mockRpc.mockResolvedValue({
            data: null,
            error,
        });

        await expect(
            getBlockedUsers()
        ).rejects.toBe(error);
    });
});

/* -------------------- MESSAGING PERMISSION -------------------- */

describe("canSendChatMessage", () => {
    test.each([true, false])(
        "returns messaging permission %s",
        async (allowed) => {
            mockRpc.mockResolvedValue({
                data: allowed,
                error: null,
            });

            await expect(
                canSendChatMessage(CHAT_ID)
            ).resolves.toBe(allowed);

            expect(mockRpc).toHaveBeenCalledWith(
                "can_send_chat_message",
                {
                    chat_id: CHAT_ID,
                }
            );
        }
    );

    test("denies messaging for null data", async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: null,
        });

        await expect(
            canSendChatMessage(CHAT_ID)
        ).resolves.toBe(false);
    });

    test("propagates database errors", async () => {
        const error = new Error("Request failed");

        mockRpc.mockResolvedValue({
            data: null,
            error,
        });

        await expect(
            canSendChatMessage(CHAT_ID)
        ).rejects.toBe(error);
    });
});

/* -------------------- INPUT VALIDATION -------------------- */

describe("UUID validation", () => {
    const invalidIds = [
        null,
        undefined,
        "",
        "invalid",
        123,
        {},
        [],
    ];

    const functions = [
        blockUser,
        unblockUser,
        isUserBlocked,
        canSendChatMessage,
    ];

    describe.each(functions)(
        "%p",
        (fn) => {
            test.each(invalidIds)(
                "rejects invalid ID %p",
                async (id) => {
                    await expect(
                        fn(id)
                    ).rejects.toThrow("Invalid");

                    expect(mockRpc).not.toHaveBeenCalled();
                }
            );
        }
    );
});