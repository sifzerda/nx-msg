// src/lib/__tests__/messages.test.js

// check message validation, supabase calls, 
// conversation ordering and group creation

import {
    sendMessage,
    createGroupChat,
    getConversations,
} from "@/lib/messages";

const mockRpc = jest.fn();
const mockInsert = jest.fn();
const mockSingle = jest.fn();
const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        auth: {
            getUser: (...args) => mockGetUser(...args),
        },
        rpc: (...args) => mockRpc(...args),
        from: () => ({
            insert: (...args) => mockInsert(...args),
        }),
    }),
}));

describe("Messaging API", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockGetUser.mockResolvedValue({
            data: { user: { id: "user-1" } },
            error: null,
        });

        mockSingle.mockResolvedValue({
            data: {
                id: "message-1",
                content: "Hello",
                sender_id: "user-1",
            },
            error: null,
        });

        mockInsert.mockReturnValue({
            select: () => ({
                single: mockSingle,
            }),
        });
    });

    test("sends a valid message", async () => {
        const result = await sendMessage("chat-1", "Hello");

        expect(mockInsert).toHaveBeenCalledWith({
            conversation_id: "chat-1",
            sender_id: "user-1",
            content: "Hello",
        });

        expect(result.content).toBe("Hello");
    });

    test("trims whitespace before sending", async () => {
        await sendMessage("chat-1", "  Hello  ");

        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                content: "Hello",
            })
        );
    });

    test("rejects empty messages", async () => {
        await expect(
            sendMessage("chat-1", "   ")
        ).rejects.toThrow("Message must contain 1–5000 characters");

        expect(mockInsert).not.toHaveBeenCalled();
    });

    test("rejects messages longer than 5000 characters", async () => {
        await expect(
            sendMessage("chat-1", "a".repeat(5001))
        ).rejects.toThrow();
    });

    test("rejects unauthenticated users", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        await expect(
            sendMessage("chat-1", "Hello")
        ).rejects.toThrow("Not authenticated");
    });

    test("creates a group with two contacts", async () => {
        mockRpc.mockResolvedValue({
            data: "new-group-id",
            error: null,
        });

        const result = await createGroupChat(
            "Friends",
            ["user-2", "user-3"]
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "create_group_chat",
            {
                group_name: "Friends",
                member_ids: ["user-2", "user-3"],
            }
        );

        expect(result).toBe("new-group-id");
    });

    test("rejects a group with fewer than two contacts", async () => {
        await expect(
            createGroupChat("Friends", ["user-2"])
        ).rejects.toThrow("Select between 2 and 49 contacts");
    });

    test("removes duplicate group members", async () => {
        mockRpc.mockResolvedValue({
            data: "group-1",
            error: null,
        });

        await createGroupChat("Friends", [
            "user-2",
            "user-2",
            "user-3",
        ]);

        expect(mockRpc).toHaveBeenCalledWith(
            "create_group_chat",
            expect.objectContaining({
                member_ids: ["user-2", "user-3"],
            })
        );
    });

    test("sorts conversations by latest message", async () => {
        mockRpc.mockImplementation((name) => {
            if (name === "get_chat_summaries") {
                return Promise.resolve({
                    data: [
                        {
                            id: "chat-1",
                            type: "private",
                            created_at: "2026-01-01",
                            last_message_at: "2026-01-02",
                        },
                    ],
                    error: null,
                });
            }

            return Promise.resolve({
                data: [
                    {
                        id: "group-1",
                        type: "group",
                        created_at: "2026-01-01",
                        last_message_at: "2026-01-05",
                    },
                ],
                error: null,
            });
        });

        const conversations = await getConversations();

        expect(conversations).toHaveLength(2);
        expect(conversations[0].id).toBe("group-1");
        expect(conversations[1].id).toBe("chat-1");
    });
});
