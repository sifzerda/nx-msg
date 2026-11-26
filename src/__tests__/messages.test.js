// src/lib/__tests__/messages.test.js

// check message validation, supabase calls, 
// conversation ordering and group creation
// src/__tests__/messages.test.js

// src/__tests__/messages.test.js

/* -------------------- MOCKS -------------------- */

jest.mock("@/lib/supabase/client", () => {
    const client = {
        rpc: jest.fn(),

        from: jest.fn(),

        auth: {
            getUser: jest.fn(),
        },
    };

    return {
        createClient: jest.fn(() => client),
    };
});

/* -------------------- IMPORTS -------------------- */

import { createClient } from "@/lib/supabase/client";

import {
    sendMessage,
    getConversations,
    createGroupChat,
    startChat,
} from "@/lib/messages";

/* -------------------- MOCK REFERENCES -------------------- */

const mockSupabase = createClient();

const mockRpc = mockSupabase.rpc;

const mockFrom = mockSupabase.from;

const mockGetUser = mockSupabase.auth.getUser;

const mockSingle = jest.fn();

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
    jest.clearAllMocks();

    mockRpc.mockReset();

    mockSingle.mockReset();

    mockFrom.mockReset();

    mockGetUser.mockReset();

    mockGetUser.mockResolvedValue({
        data: {
            user: {
                id: USER_ID,
            },
        },
        error: null,
    });
});

/* -------------------- TEXT MESSAGES -------------------- */

describe("Messaging API - text messages", () => {
    test("sends a valid message", async () => {
        const expected = mockSendSuccess();

        const result = await sendMessage(
            CHAT_ID,
            "Hello"
        );

        expect(mockRpc).toHaveBeenCalledTimes(1);

        expect(mockRpc).toHaveBeenCalledWith(
            "send_chat_message",
            expectedMessageParams()
        );

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
    test("rejects unauthenticated users", async () => {
        mockGetUser.mockResolvedValue({
            data: {
                user: null,
            },
            error: null,
        });

        mockSendError("Not authenticated");

        await expect(
            sendMessage(CHAT_ID, "Hello")
        ).rejects.toThrow("Not authenticated");
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

        expect(mockRpc).toHaveBeenCalledWith(
            "get_conversation_summaries"
        );

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

        expect(
            result.map((conversation) => conversation.id)
        ).toEqual([
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

        await expect(
            getConversations()
        ).rejects.toThrow(
            "Unable to retrieve conversations"
        );
    });
});