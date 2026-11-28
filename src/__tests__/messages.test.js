/** @jest-environment node */

// src/__tests__/messages.test.js

import {
    jest,
    describe,
    test,
    expect,
    beforeEach,
} from "@jest/globals";
import { highlightMentionParts } from "@/utils/messageUtils";

/* -------------------- MOCKS -------------------- */

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockGetUser = jest.fn();
const mockSingle = jest.fn();

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockIn = jest.fn();

const mockChannel = jest.fn();
const mockOn = jest.fn();
const mockSubscribe = jest.fn();
const mockRemoveChannel = jest.fn();

const mockRealtimeChannel = {
    on: mockOn,
    subscribe: mockSubscribe,
};

const mockSupabase = {
    rpc: mockRpc,
    from: mockFrom,

    auth: { getUser: mockGetUser },

    channel: mockChannel,
    removeChannel: mockRemoveChannel,
};

const mockCreateClient = jest.fn(() => mockSupabase);

jest.doMock("@/lib/supabase/client", () => ({
    createClient: mockCreateClient,
}));

/* -------------------- LOAD SERVICE -------------------- */

const {
    startChat,
    createGroupChat,
    getConversations,
    getMessages,
    getMessagesByIds,
    sendMessage,
    markChatRead,
    subscribeToAllMessages,
    subscribeToReadReceipts,
    validateMessage,
} = require("@/lib/messages");

/* -------------------- TEST DATA -------------------- */

const CHAT_ID = "chat-1";
const USER_ID = "user-1";
const REPLY_ID = "message-previous";

const mockMessage = {
    id: "message-1",
    conversation_id: CHAT_ID,
    sender_id: USER_ID,
    content: "Hello",
    created_at: "2026-01-01T12:00:00Z",
    reply_to_id: null,
    attachment_path: null,
    attachment_name: null,
    attachment_type: null,
    gif_id: null,
};

const mockAttachment = {
    path: "chat-1/user-1/image.webp",
    name: "image.webp",
    type: "image",
    size: 1024,
    mimeType: "image/webp",
};

/* -------------------- HELPERS -------------------- */

function mockSendSuccess(overrides = {}) {
    const message = {
        ...mockMessage,
        ...overrides,
    };

    mockSingle.mockResolvedValue({
        data: message,
        error: null,
    });

    mockRpc.mockReturnValue({
        single: mockSingle,
    });

    return message;
}

function mockSendError(message) {
    mockSingle.mockResolvedValue({
        data: null,
        error: new Error(message),
    });

    mockRpc.mockReturnValue({
        single: mockSingle,
    });
}

function expectedMessageParams(overrides = {}) {
    return {
        chat_id: CHAT_ID,
        message_content: "Hello",
        reply_id: null,
        file_path: null,
        file_name: null,
        selected_gif_id: null,
        ...overrides,
    };
}

/* -------------------- TEST SETUP -------------------- */

beforeEach(() => {
    jest.resetAllMocks();

    mockCreateClient.mockReturnValue(mockSupabase);

    mockRpc.mockReturnValue({
        single: mockSingle,
    });

    mockSingle.mockResolvedValue({
        data: mockMessage,
        error: null,
    });

    mockGetUser.mockResolvedValue({
        data: {
            user: {
                id: USER_ID,
            },
        },
        error: null,
    });

    /* Database query chains */

    mockFrom.mockReturnValue({
        select: mockSelect,
    });

    mockSelect.mockReturnValue({
        eq: mockEq,
    });

    mockEq.mockReturnValue({
        order: mockOrder,
        in: mockIn,
    });

    mockOrder.mockReturnValue({
        order: mockOrder,
        limit: mockLimit,
    });

    mockLimit.mockResolvedValue({
        data: [],
        error: null,
    });

    mockIn.mockResolvedValue({
        data: [],
        error: null,
    });

    /* Realtime query chains */

    mockChannel.mockReturnValue(mockRealtimeChannel);
    mockOn.mockReturnValue(mockRealtimeChannel);
    mockSubscribe.mockReturnValue(mockRealtimeChannel);
    mockRemoveChannel.mockResolvedValue("ok");
});

/* -------------------- TEXT MESSAGES -------------------- */

describe("Messaging API - text messages", () => {
    test("sends a valid message", async () => {
        const expected = mockSendSuccess();
        const result = await sendMessage(CHAT_ID, "Hello");

        expect(mockRpc).toHaveBeenCalledTimes(1);
        expect(mockRpc).toHaveBeenCalledWith("send_chat_message", expectedMessageParams());
        expect(mockSingle).toHaveBeenCalledTimes(1);

        expect(result).toEqual(expected);
    });

    test("trims whitespace before sending", async () => {
        mockSendSuccess();

        await sendMessage(
            CHAT_ID,
            "   Hello   "
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams({
                message_content: "Hello",
            })
        );
    });

    test("rejects empty messages", async () => {
        await expect(
            sendMessage(CHAT_ID, "")
        ).rejects.toThrow("Message cannot be empty");

        expect(mockRpc).not.toHaveBeenCalled();
    });

    test("rejects whitespace-only messages", async () => {
        await expect(
            sendMessage(CHAT_ID, "   ")
        ).rejects.toThrow("Message cannot be empty");

        expect(mockRpc).not.toHaveBeenCalled();
    });

    test("accepts messages containing 5000 characters", async () => {
        const content = "a".repeat(5000);

        mockSendSuccess({
            content,
        });

        await sendMessage(CHAT_ID, content);

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams({
                message_content: content,
            })
        );
    });

    test("rejects messages exceeding 5000 characters", async () => {
        const content = "a".repeat(5001);

        await expect(
            sendMessage(CHAT_ID, content)
        ).rejects.toThrow();

        expect(mockRpc).not.toHaveBeenCalled();
    });

    test("preserves multiline messages", async () => {
        const content = "Hello\nHow are you?";

        mockSendSuccess({
            content,
        });

        await sendMessage(CHAT_ID, content);

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams({
                message_content: content,
            })
        );
    });
});

/* -------------------- AUTHENTICATION -------------------- */

describe("Messaging API - authentication", () => {
    test("propagates authentication errors from the database", async () => {
        mockSendError("Not authenticated");

        await expect(
            sendMessage(CHAT_ID, "Hello")
        ).rejects.toThrow("Not authenticated");

        expect(mockRpc).toHaveBeenCalledTimes(1);
        expect(mockGetUser).not.toHaveBeenCalled();
    });

    test("rejects users who are not conversation members", async () => {
        mockSendError("Not a conversation member");

        await expect(
            sendMessage(CHAT_ID, "Hello")
        ).rejects.toThrow("Not a conversation member");
    });

    test("propagates database errors", async () => {
        mockSendError("Database unavailable");

        await expect(
            sendMessage(CHAT_ID, "Hello")
        ).rejects.toThrow("Database unavailable");
    });
});

/* -------------------- REPLIES -------------------- */

describe("Messaging API - replies", () => {
    test("sends a reply to an existing message", async () => {
        const expected = mockSendSuccess({
            content: "Reply message",
            reply_to_id: REPLY_ID,
        });

        const result = await sendMessage(
            CHAT_ID,
            "Reply message",
            REPLY_ID
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams({
                message_content: "Reply message",
                reply_id: REPLY_ID,
            })
        );

        expect(result).toEqual(expected);
    });

    test("propagates invalid reply errors", async () => {
        mockSendError("Invalid reply message");

        await expect(
            sendMessage(
                CHAT_ID,
                "Reply",
                "invalid-message"
            )
        ).rejects.toThrow("Invalid reply message");
    });
});

/* -------------------- ATTACHMENTS -------------------- */

describe("Messaging API - attachments", () => {
    test("sends an image with a caption", async () => {
        const expected = mockSendSuccess({
            content: "My photo",
            attachment_path: mockAttachment.path,
            attachment_name: mockAttachment.name,
            attachment_type: "image",
        });

        const result = await sendMessage(
            CHAT_ID,
            "My photo",
            null,
            mockAttachment
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams({
                message_content: "My photo",
                file_path: mockAttachment.path,
                file_name: mockAttachment.name,
            })
        );

        expect(result).toEqual(expected);
    });

    test("sends an image without text", async () => {
        mockSendSuccess({
            content: "",
            attachment_path: mockAttachment.path,
            attachment_name: mockAttachment.name,
            attachment_type: "image",
        });

        await sendMessage(
            CHAT_ID,
            "",
            null,
            mockAttachment
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams({
                message_content: "",
                file_path: mockAttachment.path,
                file_name: mockAttachment.name,
            })
        );
    });

    test("sends a document attachment", async () => {
        const attachment = {
            path: "chat-1/user-1/document.pdf",
            name: "document.pdf",
            type: "file",
            size: 2048,
            mimeType: "application/pdf",
        };

        mockSendSuccess({
            content: "",
            attachment_path: attachment.path,
            attachment_name: attachment.name,
            attachment_type: "file",
        });

        await sendMessage(
            CHAT_ID,
            "",
            null,
            attachment
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams({
                message_content: "",
                file_path: attachment.path,
                file_name: attachment.name,
            })
        );
    });

    test("sends an attachment as a reply", async () => {
        mockSendSuccess({
            content: "",
            reply_to_id: REPLY_ID,
            attachment_path: mockAttachment.path,
            attachment_name: mockAttachment.name,
            attachment_type: "image",
        });

        await sendMessage(
            CHAT_ID,
            "",
            REPLY_ID,
            mockAttachment
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams({
                message_content: "",
                reply_id: REPLY_ID,
                file_path: mockAttachment.path,
                file_name: mockAttachment.name,
            })
        );
    });
});

/* -------------------- GIF MESSAGES -------------------- */

describe("Messaging API - GIF messages", () => {
    const GIF_ID = "abc123GIF";

    test("sends a GIF without text", async () => {
        const expected = mockSendSuccess({
            content: "",
            gif_id: GIF_ID,
        });

        const result = await sendMessage(
            CHAT_ID,
            "",
            null,
            null,
            GIF_ID
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams({
                message_content: "",
                selected_gif_id: GIF_ID,
            })
        );

        expect(result).toEqual(expected);
    });

    test("sends a GIF with a caption", async () => {
        mockSendSuccess({
            content: "Funny GIF",
            gif_id: GIF_ID,
        });

        await sendMessage(
            CHAT_ID,
            "Funny GIF",
            null,
            null,
            GIF_ID
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams({
                message_content: "Funny GIF",
                selected_gif_id: GIF_ID,
            })
        );
    });

    test("sends a GIF as a reply", async () => {
        mockSendSuccess({
            content: "",
            reply_to_id: REPLY_ID,
            gif_id: GIF_ID,
        });

        await sendMessage(
            CHAT_ID,
            "",
            REPLY_ID,
            null,
            GIF_ID
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams({
                message_content: "",
                reply_id: REPLY_ID,
                selected_gif_id: GIF_ID,
            })
        );
    });

    test("rejects attachment and GIF together", async () => {
        await expect(
            sendMessage(
                CHAT_ID,
                "Hello",
                null,
                mockAttachment,
                GIF_ID
            )
        ).rejects.toThrow();

        expect(mockRpc).not.toHaveBeenCalled();
    });
});

/* -------------------- PRIVATE CONVERSATIONS -------------------- */

describe("Messaging API - private conversations", () => {
    test("starts a private conversation", async () => {
        mockRpc.mockResolvedValue({
            data: CHAT_ID,
            error: null,
        });

        const result = await startChat("user-2");

        expect(mockRpc).toHaveBeenCalledWith(
            "start_private_chat",
            {
                other_user_id: "user-2",
            }
        );

        expect(result).toBe(CHAT_ID);
    });

    test("propagates private conversation errors", async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: new Error("Contact not found"),
        });

        await expect(
            startChat("user-2")
        ).rejects.toThrow("Contact not found");
    });
});

/* -------------------- GROUP CONVERSATIONS -------------------- */

describe("Messaging API - group conversations", () => {
    test("creates a group with two contacts", async () => {
        mockRpc.mockResolvedValue({
            data: "group-1",
            error: null,
        });

        const result = await createGroupChat(
            "My Group",
            ["user-2", "user-3"]
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "create_group_chat",
            {
                group_name: "My Group",
                member_ids: ["user-2", "user-3"],
            }
        );

        expect(result).toBe("group-1");
    });

    test("propagates group creation errors", async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: new Error("Unable to create group"),
        });

        await expect(
            createGroupChat(
                "My Group",
                ["user-2", "user-3"]
            )
        ).rejects.toThrow("Unable to create group");
    });
});

/* -------------------- CONVERSATION SUMMARIES -------------------- */

describe("Messaging API - conversation summaries", () => {
    test("retrieves private and group conversations", async () => {
        const conversations = [
            {
                id: "group-1",
                type: "group",
                created_at: "2026-01-01",
                last_message_at: "2026-01-05",
                unread_count: 2,
            },
            {
                id: "chat-1",
                type: "private",
                created_at: "2026-01-01",
                last_message_at: "2026-01-03",
                unread_count: 0,
            },
        ];

        mockRpc.mockResolvedValue({
            data: conversations,
            error: null,
        });

        const result = await getConversations();

        expect(mockRpc).toHaveBeenCalledTimes(1);
        expect(mockRpc).toHaveBeenCalledWith("get_conversation_summaries");

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe("group-1");
        expect(result[1].id).toBe("chat-1");
    });

    test("preserves database conversation ordering", async () => {
        const conversations = [
            {
                id: "chat-2",
                type: "private",
                last_message_at: "2026-01-10",
            },
            {
                id: "group-1",
                type: "group",
                last_message_at: "2026-01-05",
            },
            {
                id: "chat-1",
                type: "private",
                last_message_at: "2026-01-03",
            },
        ];

        mockRpc.mockResolvedValue({
            data: conversations,
            error: null,
        });

        const result = await getConversations();

        expect(result.map((conversation) => conversation.id)).toEqual([
            "chat-2",
            "group-1",
            "chat-1",
        ]);
    });

    test("returns an empty conversation list", async () => {
        mockRpc.mockResolvedValue({
            data: [],
            error: null,
        });

        const result = await getConversations();

        expect(result).toEqual([]);
    });

    test("handles null conversation data", async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: null,
        });

        const result = await getConversations();

        expect(result).toEqual([]);
    });

    test("propagates conversation retrieval errors", async () => {
        mockRpc.mockResolvedValue({
            data: null,
            error: new Error("Unable to retrieve conversations"),
        });

        await expect(getConversations()).rejects.toThrow("Unable to retrieve conversations");
    });
});

/* -------------------- BLOCKING PERMISSIONS -------------------- */

describe("Messaging API - blocking permissions", () => {
    function createPermissionError(message) {
        return Object.assign(new Error(message), { code: "42501" });
    }

    function rejectMessage(error) {
        mockSingle.mockResolvedValue({
            data: null,
            error,
        });
    }

    test("propagates blocked messaging errors", async () => {
        const error = createPermissionError("Messaging is unavailable in this conversation");

        rejectMessage(error);
        await expect(sendMessage(CHAT_ID, "Hello")).rejects.toBe(error);
    });

    test("preserves the database permission error code", async () => {
        rejectMessage(createPermissionError("Messaging is unavailable in this conversation"));

        await expect(sendMessage(CHAT_ID, "Hello")).rejects.toMatchObject({
            code: "42501",
        });
    });

    test("does not retry a rejected message", async () => {
        rejectMessage(createPermissionError("Messaging is unavailable in this conversation"));

        await expect(sendMessage(CHAT_ID, "Hello")).rejects.toThrow();

        expect(mockRpc).toHaveBeenCalledTimes(1);
        expect(mockSingle).toHaveBeenCalledTimes(1);
    });

    test("does not bypass messaging restrictions using direct inserts", async () => {
        rejectMessage(createPermissionError("Messaging is unavailable in this conversation"));

        await expect(sendMessage(CHAT_ID, "Hello")).rejects.toThrow();

        expect(mockFrom).not.toHaveBeenCalled();
    });

    test("propagates blocked attachment errors", async () => {
        rejectMessage(createPermissionError("Messaging is unavailable in this conversation"));

        await expect(sendMessage(CHAT_ID, "", null, mockAttachment)
        ).rejects.toMatchObject({
            code: "42501",
        });
    });

    test("propagates blocked GIF errors", async () => {
        rejectMessage(createPermissionError("Messaging is unavailable in this conversation"));

        await expect(sendMessage(CHAT_ID, "", null, null, "abc123GIF")).rejects.toMatchObject({
            code: "42501",
        });
    });

    test("propagates blocked reply errors", async () => {
        rejectMessage(createPermissionError("Messaging is unavailable in this conversation"));

        await expect(sendMessage(CHAT_ID, "Reply", REPLY_ID)).rejects.toMatchObject({
            code: "42501",
        });
    });

    test("propagates blocked private conversation creation errors", async () => {
        const error = createPermissionError("Private messaging is unavailable");

        mockRpc.mockResolvedValue({
            data: null,
            error,
        });

        await expect(startChat("user-2")).rejects.toBe(error);

        expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    test("preserves own block status in conversation summaries", async () => {
        const conversations = [
            {
                id: CHAT_ID,
                type: "private",
                is_blocked_by_me: true,
                can_send_messages: false,
            },
        ];

        mockRpc.mockResolvedValue({
            data: conversations,
            error: null,
        });

        const result = await getConversations();

        expect(result).toEqual(conversations);
        expect(result[0].is_blocked_by_me).toBe(true);
        expect(result[0].can_send_messages).toBe(false);
    });

    test("preserves generic messaging restrictions", async () => {
        const conversations = [
            {
                id: CHAT_ID,
                type: "private",
                is_blocked_by_me: false,
                can_send_messages: false,
            },
        ];

        mockRpc.mockResolvedValue({
            data: conversations,
            error: null,
        });

        const result = await getConversations();

        expect(result[0].is_blocked_by_me).toBe(false);
        expect(result[0].can_send_messages).toBe(false);
    });

    test("preserves available private messaging permissions", async () => {
        mockRpc.mockResolvedValue({
            data: [
                {
                    id: CHAT_ID,
                    type: "private",
                    is_blocked_by_me: false,
                    can_send_messages: true,
                },
            ],
            error: null,
        });

        const result = await getConversations();

        expect(result[0].can_send_messages).toBe(true);
    });

    test("preserves group messaging permissions", async () => {
        mockRpc.mockResolvedValue({
            data: [
                {
                    id: "group-1",
                    type: "group",
                    is_blocked_by_me: false,
                    can_send_messages: true,
                },
            ],
            error: null,
        });

        const result = await getConversations();

        expect(result[0].can_send_messages).toBe(true);
    });

    test("does not retrieve permissions separately for each conversation", async () => {
        mockRpc.mockResolvedValue({
            data: Array.from(
                { length: 100 },
                (_, index) => ({
                    id: `chat-${index}`,
                    type: "private",
                    is_blocked_by_me: false,
                    can_send_messages: true,
                })
            ),
            error: null,
        });

        const result = await getConversations();

        expect(result).toHaveLength(100);

        expect(mockRpc).toHaveBeenCalledTimes(1);
        expect(mockFrom).not.toHaveBeenCalled();
        expect(mockGetUser).not.toHaveBeenCalled();
    });
});

/* -------------------- MESSAGE VALIDATION -------------------- */

describe("validateMessage", () => {
    test("trims message content", () => {
        expect(
            validateMessage("  Hello  ")
        ).toBe("Hello");
    });

    test("rejects invalid content types", () => {
        expect(() =>
            validateMessage(null)
        ).toThrow("Invalid message content");
    });

    test("rejects empty messages", () => {
        expect(() =>
            validateMessage("   ")
        ).toThrow("Message cannot be empty");
    });

    test("accepts attachment-only messages", () => {
        expect(
            validateMessage("", { name: "file.pdf" })
        ).toBe("");
    });

    test("accepts GIF-only messages", () => {
        expect(
            validateMessage("", null, "abc123")
        ).toBe("");
    });

    test("rejects messages exceeding the limit", () => {
        expect(() =>
            validateMessage("a".repeat(5001))
        ).toThrow("Message is too long");
    });

    test("accepts messages at the limit", () => {
        const message = "a".repeat(5000);

        expect(
            validateMessage(message)
        ).toBe(message);
    });

    test("rejects attachments combined with GIFs", () => {
        expect(() =>
            validateMessage(
                "Hello",
                { name: "file.pdf" },
                "abc123"
            )
        ).toThrow(
            "A message cannot contain both a GIF and an attachment"
        );
    });

    test("rejects invalid GIF IDs", () => {
        expect(() =>
            validateMessage("Hello", null, "invalid gif!")
        ).toThrow("Invalid GIF ID");
    });
});

/* -------------------- GROUP VALIDATION -------------------- */

describe("Messaging API - group validation", () => {
    function mockGroupSuccess() {
        mockRpc.mockResolvedValue({
            data: "group-1",
            error: null,
        });
    }

    test("trims the group name", async () => {
        mockGroupSuccess();

        await createGroupChat(
            "   My Group   ",
            ["user-2", "user-3"]
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "create_group_chat",
            {
                group_name: "My Group",
                member_ids: ["user-2", "user-3"],
            }
        );
    });

    test.each(["", "   "])(
        "rejects empty group names: %p",
        async (name) => {
            await expect(
                createGroupChat(
                    name,
                    ["user-2", "user-3"]
                )
            ).rejects.toThrow(
                "Group name must contain 1–100 characters"
            );

            expect(mockRpc).not.toHaveBeenCalled();
        }
    );

    test("accepts a 100-character group name", async () => {
        mockGroupSuccess();

        const name = "a".repeat(100);

        await createGroupChat(
            name,
            ["user-2", "user-3"]
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "create_group_chat",
            {
                group_name: name,
                member_ids: ["user-2", "user-3"],
            }
        );
    });

    test("rejects a group name exceeding 100 characters", async () => {
        await expect(
            createGroupChat(
                "a".repeat(101),
                ["user-2", "user-3"]
            )
        ).rejects.toThrow(
            "Group name must contain 1–100 characters"
        );

        expect(mockRpc).not.toHaveBeenCalled();
    });

    test("removes duplicate group members", async () => {
        mockGroupSuccess();

        await createGroupChat(
            "My Group",
            [
                "user-2",
                "user-2",
                "user-3",
                "user-3",
            ]
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "create_group_chat",
            {
                group_name: "My Group",
                member_ids: ["user-2", "user-3"],
            }
        );
    });

    test("removes empty group member IDs", async () => {
        mockGroupSuccess();

        await createGroupChat(
            "My Group",
            [
                "user-2",
                null,
                undefined,
                "",
                "user-3",
            ]
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "create_group_chat",
            {
                group_name: "My Group",
                member_ids: ["user-2", "user-3"],
            }
        );
    });

    test.each([
        { members: [] },
        { members: ["user-2"] },
        { members: ["user-2", "user-2"] },
    ])(
        "rejects insufficient unique members: $members",
        async ({ members }) => {
            await expect(
                createGroupChat("My Group", members)
            ).rejects.toThrow(
                "Select between 2 and 49 contacts"
            );

            expect(mockRpc).not.toHaveBeenCalled();
        }
    );

    test("accepts 49 contacts", async () => {
        mockGroupSuccess();

        const members = Array.from(
            { length: 49 },
            (_, index) => `user-${index + 2}`
        );

        await createGroupChat(
            "Large Group",
            members
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "create_group_chat",
            {
                group_name: "Large Group",
                member_ids: members,
            }
        );
    });

    test("rejects more than 49 contacts", async () => {
        const members = Array.from(
            { length: 50 },
            (_, index) => `user-${index + 2}`
        );

        await expect(
            createGroupChat(
                "Large Group",
                members
            )
        ).rejects.toThrow(
            "Select between 2 and 49 contacts"
        );

        expect(mockRpc).not.toHaveBeenCalled();
    });
});

/* -------------------- MESSAGE RETRIEVAL -------------------- */

describe("Messaging API - message retrieval", () => {
    test("retrieves messages from the correct table", async () => {
        await getMessages(CHAT_ID);

        expect(mockFrom).toHaveBeenCalledWith(
            "messages"
        );
    });

    test("restricts messages to the requested conversation", async () => {
        await getMessages(CHAT_ID);

        expect(mockEq).toHaveBeenCalledWith(
            "conversation_id",
            CHAT_ID
        );
    });

    test("limits message retrieval to 100 messages", async () => {
        await getMessages(CHAT_ID);

        expect(mockLimit).toHaveBeenCalledWith(100);
    });

    test("requests deterministic descending ordering", async () => {
        await getMessages(CHAT_ID);

        expect(mockOrder).toHaveBeenNthCalledWith(
            1,
            "created_at",
            { ascending: false }
        );

        expect(mockOrder).toHaveBeenNthCalledWith(
            2,
            "id",
            { ascending: false }
        );
    });

    test("returns messages in chronological order", async () => {
        const newest = {
            id: "message-3",
            created_at: "2026-01-03",
        };

        const middle = {
            id: "message-2",
            created_at: "2026-01-02",
        };

        const oldest = {
            id: "message-1",
            created_at: "2026-01-01",
        };

        mockLimit.mockResolvedValue({
            data: [
                newest,
                middle,
                oldest,
            ],
            error: null,
        });

        const result = await getMessages(CHAT_ID);

        expect(result).toEqual([
            oldest,
            middle,
            newest,
        ]);
    });

    test("selects attachment and GIF metadata", async () => {
        await getMessages(CHAT_ID);

        const columns =
            mockSelect.mock.calls[0][0]
                .split(",")
                .map((column) => column.trim());

        expect(columns).toEqual(
            expect.arrayContaining([
                "id",
                "conversation_id",
                "sender_id",
                "content",
                "created_at",
                "reply_to_id",
                "attachment_path",
                "attachment_type",
                "attachment_name",
                "attachment_size",
                "attachment_mime_type",
                "gif_id",
            ])
        );
    });

    test("returns an empty message list", async () => {
        expect(
            await getMessages(CHAT_ID)
        ).toEqual([]);
    });

    test("handles null message data", async () => {
        mockLimit.mockResolvedValue({
            data: null,
            error: null,
        });

        expect(
            await getMessages(CHAT_ID)
        ).toEqual([]);
    });

    test("propagates message retrieval errors", async () => {
        mockLimit.mockResolvedValue({
            data: null,
            error: new Error(
                "Unable to retrieve messages"
            ),
        });

        await expect(
            getMessages(CHAT_ID)
        ).rejects.toThrow(
            "Unable to retrieve messages"
        );
    });

    test("retrieves messages with one database query chain", async () => {
        await getMessages(CHAT_ID);

        expect(mockFrom).toHaveBeenCalledTimes(1);
        expect(mockSelect).toHaveBeenCalledTimes(1);
        expect(mockLimit).toHaveBeenCalledTimes(1);

        expect(mockRpc).not.toHaveBeenCalled();
    });
});

/* -------------------- MESSAGES BY IDS -------------------- */

describe("Messaging API - messages by IDs", () => {
    test("retrieves multiple messages in one query", async () => {
        const messages = [
            { id: "message-1" },
            { id: "message-2" },
        ];

        mockIn.mockResolvedValue({
            data: messages,
            error: null,
        });

        const result = await getMessagesByIds(
            CHAT_ID,
            ["message-1", "message-2"]
        );

        expect(result).toEqual(messages);

        expect(mockFrom).toHaveBeenCalledTimes(1);

        expect(mockIn).toHaveBeenCalledWith(
            "id",
            ["message-1", "message-2"]
        );
    });

    test("removes duplicate message IDs", async () => {
        await getMessagesByIds(
            CHAT_ID,
            [
                "message-1",
                "message-1",
                "message-2",
            ]
        );

        expect(mockIn).toHaveBeenCalledWith(
            "id",
            ["message-1", "message-2"]
        );
    });

    test("removes empty message IDs", async () => {
        await getMessagesByIds(
            CHAT_ID,
            [
                "message-1",
                null,
                undefined,
                "",
            ]
        );

        expect(mockIn).toHaveBeenCalledWith(
            "id",
            ["message-1"]
        );
    });

    test("restricts referenced messages to the conversation", async () => {
        await getMessagesByIds(
            CHAT_ID,
            ["message-1"]
        );

        expect(mockEq).toHaveBeenCalledWith(
            "conversation_id",
            CHAT_ID
        );
    });

    test("does not query when the ID list is empty", async () => {
        expect(
            await getMessagesByIds(CHAT_ID, [])
        ).toEqual([]);

        expect(mockFrom).not.toHaveBeenCalled();
    });

    test("does not query when all IDs are empty", async () => {
        expect(
            await getMessagesByIds(
                CHAT_ID,
                [null, undefined, ""]
            )
        ).toEqual([]);

        expect(mockFrom).not.toHaveBeenCalled();
    });

    test("does not query without a conversation ID", async () => {
        expect(
            await getMessagesByIds(
                null,
                ["message-1"]
            )
        ).toEqual([]);

        expect(mockFrom).not.toHaveBeenCalled();
    });

    test("handles null response data", async () => {
        mockIn.mockResolvedValue({
            data: null,
            error: null,
        });

        expect(
            await getMessagesByIds(
                CHAT_ID,
                ["message-1"]
            )
        ).toEqual([]);
    });

    test("propagates referenced message retrieval errors", async () => {
        mockIn.mockResolvedValue({
            data: null,
            error: new Error("Retrieval failed"),
        });

        await expect(
            getMessagesByIds(
                CHAT_ID,
                ["message-1"]
            )
        ).rejects.toThrow("Retrieval failed");
    });
});

/* -------------------- GIF VALIDATION -------------------- */

describe("Messaging API - GIF validation", () => {
    test.each([
        "",
        "invalid gif",
        "invalid/gif",
        "<script>",
        "abc?123",
        "a".repeat(101),
    ])("rejects invalid GIF IDs: %p", async (gifId) => {
        await expect(
            sendMessage(
                CHAT_ID,
                "Hello",
                null,
                null,
                gifId
            )
        ).rejects.toThrow("Invalid GIF ID");

        expect(mockRpc).not.toHaveBeenCalled();
    });

    test("accepts a null GIF ID for ordinary messages", async () => {
        mockSendSuccess();

        await sendMessage(
            CHAT_ID,
            "Hello",
            null,
            null,
            null
        );

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams()
        );
    });
});

/* -------------------- READ RECEIPTS -------------------- */

describe("Messaging API - read receipts", () => {
    test("marks the requested conversation as read", async () => {
        mockRpc.mockResolvedValue({
            error: null,
        });

        await markChatRead(CHAT_ID);

        expect(mockRpc).toHaveBeenCalledWith(
            "mark_chat_read",
            {
                chat_id: CHAT_ID,
            }
        );
    });

    test("marks a conversation as read using one RPC", async () => {
        mockRpc.mockResolvedValue({
            error: null,
        });

        await markChatRead(CHAT_ID);

        expect(mockRpc).toHaveBeenCalledTimes(1);
        expect(mockFrom).not.toHaveBeenCalled();
    });

    test("propagates mark-as-read errors", async () => {
        mockRpc.mockResolvedValue({
            error: new Error(
                "Unable to mark conversation as read"
            ),
        });

        await expect(
            markChatRead(CHAT_ID)
        ).rejects.toThrow(
            "Unable to mark conversation as read"
        );
    });

});

/* -------------------- REALTIME SUBSCRIPTIONS -------------------- */

describe("Messaging API - global message subscription", () => {
    test("creates a user-specific channel", () => {
        subscribeToAllMessages(
            USER_ID,
            jest.fn()
        );

        expect(mockChannel).toHaveBeenCalledWith(
            `messages:${USER_ID}`
        );
    });

    test("subscribes to message insert events", () => {
        subscribeToAllMessages(
            USER_ID,
            jest.fn()
        );

        expect(mockOn).toHaveBeenCalledWith(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages",
            },
            expect.any(Function)
        );
    });

    test("forwards incoming messages", () => {
        const onMessage = jest.fn();

        subscribeToAllMessages(
            USER_ID,
            onMessage
        );

        const callback =
            mockOn.mock.calls[0][2];

        callback({
            new: mockMessage,
        });

        expect(onMessage).toHaveBeenCalledWith(
            mockMessage
        );
    });

    test("forwards the connection status callback", () => {
        const onStatus = jest.fn();

        subscribeToAllMessages(
            USER_ID,
            jest.fn(),
            onStatus
        );

        expect(mockSubscribe).toHaveBeenCalledWith(
            onStatus
        );
    });

    test("removes the channel on unsubscribe", () => {
        const unsubscribe =
            subscribeToAllMessages(
                USER_ID,
                jest.fn()
            );

        unsubscribe();

        expect(mockRemoveChannel).toHaveBeenCalledWith(
            mockRealtimeChannel
        );
    });

    test("does not make database queries when subscribing", () => {
        subscribeToAllMessages(
            USER_ID,
            jest.fn()
        );

        expect(mockRpc).not.toHaveBeenCalled();
        expect(mockFrom).not.toHaveBeenCalled();
    });
});

describe("Messaging API - read receipt subscription", () => {
    test("creates a read receipt channel", () => {
        subscribeToReadReceipts(CHAT_ID, jest.fn());

        expect(mockChannel).toHaveBeenCalledWith(expect.stringMatching(/^read-receipts:chat-1:/));
    });

    test("uses unique channel names", () => {
        subscribeToReadReceipts(CHAT_ID, jest.fn());
        subscribeToReadReceipts(CHAT_ID, jest.fn());

        const first = mockChannel.mock.calls[0][0];
        const second = mockChannel.mock.calls[1][0];

        expect(first).not.toBe(second);
    });

    test("subscribes to conversation member updates", () => {
        subscribeToReadReceipts(CHAT_ID, jest.fn());

        expect(mockOn).toHaveBeenCalledWith(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "conversation_members",
                filter: `conversation_id=eq.${CHAT_ID}`,
            },
            expect.any(Function)
        );
    });

    test("forwards incoming read receipt updates", () => {
        const onReceipt = jest.fn();

        subscribeToReadReceipts(CHAT_ID, onReceipt);

        const member = {
            conversation_id: CHAT_ID,
            user_id: "user-2",
            last_read_at: "2026-01-01T12:00:00Z",
        };

        const callback = mockOn.mock.calls[0][2];

        callback({
            new: member,
        });

        expect(onReceipt).toHaveBeenCalledWith(member);
    });

    test("forwards read receipt connection status", () => {
        const onStatus = jest.fn();

        subscribeToReadReceipts(
            CHAT_ID,
            jest.fn(),
            onStatus
        );

        expect(mockSubscribe).toHaveBeenCalledWith(
            onStatus
        );
    });

    test("removes the read receipt channel", () => {
        const unsubscribe =
            subscribeToReadReceipts(
                CHAT_ID,
                jest.fn()
            );

        unsubscribe();

        expect(mockRemoveChannel).toHaveBeenCalledWith(
            mockRealtimeChannel
        );
    });
});

/* --------------------- GROUP MENTIONS -------------------- */ 

describe("highlightMentionParts", () => {
  const mentions = [
    {
      user_id: "user-1",
      username: "sarah",
    },
  ];

  test("highlights verified mentions", () => {
    const parts = [
      {
        type: "text",
        value: "Hello @sarah!",
      },
    ];

    expect(
      highlightMentionParts(parts, mentions)
    ).toEqual([
      {
        type: "text",
        value: "Hello ",
      },
      {
        type: "mention",
        value: "@sarah",
        userId: "user-1",
        username: "sarah",
      },
      {
        type: "text",
        value: "!",
      },
    ]);
  });

  test("does not highlight unknown users", () => {
    const parts = [
      {
        type: "text",
        value: "Hello @unknown",
      },
    ];

    expect(
      highlightMentionParts(parts, mentions)
    ).toBe(parts);
  });

  test("preserves email addresses", () => {
    const parts = [
      {
        type: "text",
        value: "example@sarah.com",
      },
    ];

    expect(
      highlightMentionParts(parts, mentions)
    ).toBe(parts);
  });

  test("preserves links", () => {
    const parts = [
      {
        type: "link",
        value: "https://example.com/@sarah",
        url: "https://example.com/@sarah",
      },
    ];

    expect(
      highlightMentionParts(parts, mentions)
    ).toBe(parts);
  });

  test("does not match partial usernames", () => {
    const parts = [
      {
        type: "text",
        value: "@sarah123",
      },
    ];

    expect(
      highlightMentionParts(parts, mentions)
    ).toBe(parts);
  });

  test("highlights repeated mentions", () => {
    const parts = [
      {
        type: "text",
        value: "@sarah and @sarah",
      },
    ];

    const result = highlightMentionParts(
      parts,
      mentions
    );

    expect(
      result.filter(
        (part) => part.type === "mention"
      )
    ).toHaveLength(2);
  });

  test("handles missing metadata", () => {
    const parts = [
      {
        type: "text",
        value: "@sarah",
      },
    ];

    expect(
      highlightMentionParts(parts, null)
    ).toBe(parts);
  });

  test("preserves ordinary messages", () => {
    const parts = [
      {
        type: "text",
        value: "Hello everyone",
      },
    ];

    expect(
      highlightMentionParts(parts, mentions)
    ).toBe(parts);
  });
});