/** @jest-environment node */

// src/__tests__/pushSend.test.js

import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

/* -------------------- MOCKS -------------------- */

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockDelete = jest.fn();
const mockIn = jest.fn();

const mockSendWebPush = jest.fn();
const mockIsValidPushEndpoint = jest.fn();
const mockCreateAdminClient = jest.fn();

jest.doMock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

jest.doMock("@/lib/webPush", () => ({
  sendWebPush: mockSendWebPush,
  isValidPushEndpoint: mockIsValidPushEndpoint,
}));

const { POST } = require("@/app/api/push/send/route");

/* -------------------- CONSTANTS -------------------- */

const SECRET = "test-webhook-secret";

const ORIGINAL_SECRET =
  process.env.PUSH_WEBHOOK_SECRET;

const MESSAGE_ID =
  "11111111-1111-4111-8111-111111111111";

const CONVERSATION_ID =
  "22222222-2222-4222-8222-222222222222";

const SENDER_ID =
  "33333333-3333-4333-8333-333333333333";

const MESSAGE = {
  id: MESSAGE_ID,
  conversation_id: CONVERSATION_ID,
  sender_id: SENDER_ID,
  content: "Hello everyone",
  gif_id: null,
  attachment_type: null,
  attachment_name: null,
};

const SENDER = {
  display_name: "Alex Morgan",
  username: "alex",
};

const PRIVATE_CONVERSATION = {
  type: "private",
  name: null,
};

const GROUP_CONVERSATION = {
  type: "group",
  name: "Music Group",
};

const EVENT = {
  type: "INSERT",
  table: "messages",
  schema: "public",
  record: {
    id: MESSAGE_ID,
  },
};

/* -------------------- FIXTURES -------------------- */

function createSubscription(index = 1, overrides = {}) {
  return {
    id: `subscription-${index}`,
    endpoint:
      `https://fcm.googleapis.com/fcm/send/device-${index}`,
    p256dh: `encryption-key-${index}`,
    auth_key: `authentication-key-${index}`,
    is_mentioned: false,
    ...overrides,
  };
}

function createDelivery(overrides = {}) {
  return {
    message: { ...MESSAGE },
    sender: { ...SENDER },
    conversation: { ...PRIVATE_CONVERSATION },
    subscriptions: [createSubscription()],
    ...overrides,
  };
}

function setDelivery(overrides = {}) {
  mockRpc.mockResolvedValue({
    data: createDelivery(overrides),
    error: null,
  });
}

function createRequest(
  payload = EVENT,
  authorization = `Bearer ${SECRET}`
) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (authorization !== null) {
    headers.Authorization = authorization;
  }

  return new Request(
    "http://localhost/api/push/send",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );
}

async function execute(
  payload = EVENT,
  authorization = `Bearer ${SECRET}`
) {
  const response = await POST(
    createRequest(payload, authorization)
  );

  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}

function getNotification(index = 0) {
  const [, payload] =
    mockSendWebPush.mock.calls[index];

  return JSON.parse(payload);
}

function createPushError(statusCode) {
  return Object.assign(
    new Error(`Push delivery failed: ${statusCode}`),
    { statusCode }
  );
}

function deferred() {
  let resolve;

  const promise = new Promise((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

/* -------------------- SETUP -------------------- */

let errorSpy;

beforeEach(() => {
  jest.resetAllMocks();

  process.env.PUSH_WEBHOOK_SECRET = SECRET;

  mockCreateAdminClient.mockReturnValue({
    rpc: mockRpc,
    from: mockFrom,
  });

  mockFrom.mockReturnValue({
    delete: mockDelete,
  });

  mockDelete.mockReturnValue({
    in: mockIn,
  });

  mockIn.mockResolvedValue({
    error: null,
  });

  mockSendWebPush.mockResolvedValue({
    statusCode: 201,
  });

  mockIsValidPushEndpoint.mockReturnValue(true);

  setDelivery();

  errorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();

  if (ORIGINAL_SECRET === undefined) {
    delete process.env.PUSH_WEBHOOK_SECRET;
  } else {
    process.env.PUSH_WEBHOOK_SECRET =
      ORIGINAL_SECRET;
  }
});

/* -------------------- AUTHENTICATION -------------------- */

describe("Push delivery - authentication", () => {
  test.each([
    null,
    "",
    "Basic credentials",
    "Bearer",
    "Bearer incorrect-secret",
    "Bearer test-webhook-secrex",
  ])("rejects invalid authorization %p", async (authorization) => {
    const result = await execute(
      EVENT,
      authorization
    );

    expect(result.status).toBe(401);

    expect(result.body).toEqual({
      error: "Unauthorized",
    });

    expect(mockCreateAdminClient)
      .not.toHaveBeenCalled();

    expect(mockRpc).not.toHaveBeenCalled();

    expect(mockSendWebPush)
      .not.toHaveBeenCalled();
  });

  test("rejects missing server secret", async () => {
    delete process.env.PUSH_WEBHOOK_SECRET;

    const result = await execute();

    expect(result.status).toBe(401);

    expect(mockCreateAdminClient)
      .not.toHaveBeenCalled();
  });

  test.each([
    `Bearer ${SECRET}`,
    `bearer ${SECRET}`,
    `BEARER ${SECRET}`,
  ])("accepts valid authorization %s", async (authorization) => {
    const result = await execute(
      EVENT,
      authorization
    );

    expect(result.status).toBe(200);

    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});

/* -------------------- EVENT VALIDATION -------------------- */

describe("Push delivery - event validation", () => {
  test.each([
    null,
    {},
    { ...EVENT, type: "UPDATE" },
    { ...EVENT, type: "DELETE" },
    { ...EVENT, table: "profiles" },
    { ...EVENT, schema: "private" },
  ])("rejects invalid event %p", async (event) => {
    const result = await execute(event);

    expect(result.status).toBe(400);

    expect(result.body).toEqual({
      error: "Invalid event",
    });

    expect(mockCreateAdminClient)
      .not.toHaveBeenCalled();
  });

  test("rejects malformed JSON", async () => {
    const request = new Request(
      "http://localhost/api/push/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SECRET}`,
          "Content-Type": "application/json",
        },
        body: "{invalid-json",
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(400);

    expect(await response.json()).toEqual({
      error: "Invalid event",
    });

    expect(mockCreateAdminClient)
      .not.toHaveBeenCalled();
  });

  test.each([
    undefined,
    null,
    "",
    "invalid-id",
    123,
    {},
  ])("rejects invalid message ID %p", async (id) => {
    const result = await execute({
      ...EVENT,
      record: { id },
    });

    expect(result.status).toBe(400);

    expect(result.body).toEqual({
      error: "Invalid message ID",
    });

    expect(mockCreateAdminClient)
      .not.toHaveBeenCalled();
  });

  test("rejects a missing record", async () => {
    const result = await execute({
      ...EVENT,
      record: undefined,
    });

    expect(result.status).toBe(400);

    expect(result.body.error)
      .toBe("Invalid message ID");
  });
});

/* -------------------- DATABASE -------------------- */

describe("Push delivery - database", () => {
  test("uses the consolidated delivery RPC", async () => {
    await execute();

    expect(mockCreateAdminClient)
      .toHaveBeenCalledTimes(1);

    expect(mockRpc).toHaveBeenCalledTimes(1);

    expect(mockRpc).toHaveBeenCalledWith(
      "get_message_push_delivery",
      {
        target_message_id: MESSAGE_ID,
      }
    );
  });

  test("normalises uppercase message IDs", async () => {
    const id =
      "abcdef12-abcd-4abc-8abc-abcdef123456";

    setDelivery({
      message: {
        ...MESSAGE,
        id,
      },
    });

    const result = await execute({
      ...EVENT,
      record: {
        id: id.toUpperCase(),
      },
    });

    expect(result.status).toBe(200);

    expect(mockRpc).toHaveBeenCalledWith(
      "get_message_push_delivery",
      {
        target_message_id: id,
      }
    );
  });

  test("returns 404 when the message does not exist", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await execute();

    expect(result.status).toBe(404);

    expect(result.body).toEqual({
      error: "Message not found",
    });

    expect(mockSendWebPush)
      .not.toHaveBeenCalled();
  });

  test("handles database errors", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "Database unavailable",
        code: "TEST_ERROR",
      },
    });

    const result = await execute();

    expect(result.status).toBe(500);

    expect(result.body).toEqual({
      error: "Push delivery failed",
    });

    expect(mockSendWebPush)
      .not.toHaveBeenCalled();

    expect(errorSpy).toHaveBeenCalledWith(
      "[Push] Delivery failed:",
      {
        message: "Database unavailable",
        code: "TEST_ERROR",
      }
    );
  });

  test.each([
    { message: null },
    { subscriptions: null },
    { subscriptions: {} },
    {
      message: {
        ...MESSAGE,
        id: "invalid-id",
      },
    },
    {
      message: {
        ...MESSAGE,
        conversation_id: "invalid-id",
      },
    },
    {
      message: {
        ...MESSAGE,
        id: SENDER_ID,
      },
    },
  ])("rejects invalid RPC response %p", async (overrides) => {
    setDelivery(overrides);

    const result = await execute();

    expect(result.status).toBe(500);

    expect(result.body.error)
      .toBe("Push delivery failed");

    expect(mockSendWebPush)
      .not.toHaveBeenCalled();
  });

  test("does not expose internal database errors", async () => {
    mockRpc.mockRejectedValue(
      new Error("Sensitive internal database details")
    );

    const result = await execute();

    expect(result.status).toBe(500);

    expect(result.body).toEqual({
      error: "Push delivery failed",
    });
  });
});

/* -------------------- PRIVATE NOTIFICATIONS -------------------- */

describe("Push delivery - private notifications", () => {
  test("sends the correct notification", async () => {
    const subscription = createSubscription();

    setDelivery({
      subscriptions: [subscription],
    });

    const result = await execute();

    expect(result.status).toBe(200);

    expect(result.body).toEqual({
      success: true,
      sent: 1,
      failed: 0,
      expired: 0,
    });

    expect(mockSendWebPush)
      .toHaveBeenCalledTimes(1);

    expect(mockSendWebPush.mock.calls[0][0])
      .toEqual(subscription);

    expect(mockSendWebPush.mock.calls[0][1])
      .toEqual(expect.any(String));

    expect(getNotification()).toEqual({
      messageId: MESSAGE_ID,
      title: "Alex Morgan sent you a message",
      body: "Hello everyone",
      url: `/messages/${CONVERSATION_ID}`,
      tag: `chat:${CONVERSATION_ID}`,
    });
  });

  test.each([
    [
      { display_name: "", username: "alex" },
      "alex",
    ],
    [
      { display_name: "  ", username: " alex " },
      "alex",
    ],
    [
      { display_name: " Alex ", username: "alex" },
      "Alex",
    ],
    [null, "Someone"],
    [{}, "Someone"],
  ])("uses the correct sender fallback %p", async (sender, name) => {
    setDelivery({ sender });

    await execute();

    expect(getNotification().title)
      .toBe(`${name} sent you a message`);
  });

  test("limits notification title length", async () => {
    setDelivery({
      sender: {
        display_name: "A".repeat(200),
      },
    });

    await execute();

    expect(getNotification().title)
      .toHaveLength(120);
  });

  test("uses database content instead of webhook content", async () => {
    await execute({
      ...EVENT,
      record: {
        id: MESSAGE_ID,
        content: "Untrusted webhook content",
        sender_id: "untrusted-sender",
      },
    });

    expect(getNotification().body)
      .toBe(MESSAGE.content);
  });

  test("does not generate mention titles for private chats", async () => {
    setDelivery({
      subscriptions: [
        createSubscription(1, {
          is_mentioned: true,
        }),
      ],
    });

    await execute();

    expect(getNotification().title)
      .toBe("Alex Morgan sent you a message");
  });
});

/* -------------------- GROUP NOTIFICATIONS -------------------- */

describe("Push delivery - group notifications", () => {
  test("includes the sender and group name", async () => {
    setDelivery({
      conversation: GROUP_CONVERSATION,
    });

    const result = await execute();

    expect(result.status).toBe(200);

    expect(getNotification().title)
      .toBe("Alex Morgan · Music Group");
  });

  test.each([null, undefined, "", "   "])(
    "uses a fallback group name for %p",
    async (name) => {
      setDelivery({
        conversation: {
          type: "group",
          name,
        },
      });

      await execute();

      expect(getNotification().title)
        .toBe("Alex Morgan · Group chat");
    }
  );

  test("trims the group name", async () => {
    setDelivery({
      conversation: {
        type: "group",
        name: "  Music Group  ",
      },
    });

    await execute();

    expect(getNotification().title)
      .toBe("Alex Morgan · Music Group");
  });

  test("sends personalised notifications to mentioned recipients", async () => {
    setDelivery({
      conversation: GROUP_CONVERSATION,
      subscriptions: [
        createSubscription(1),
        createSubscription(2, {
          is_mentioned: true,
        }),
        createSubscription(3),
      ],
    });

    const result = await execute();

    expect(result.body).toEqual({
      success: true,
      sent: 3,
      failed: 0,
      expired: 0,
    });

    expect(getNotification(0).title)
      .toBe("Alex Morgan · Music Group");

    expect(getNotification(1).title)
      .toBe("Alex Morgan mentioned you in Music Group");

    expect(getNotification(2).title)
      .toBe("Alex Morgan · Music Group");
  });

  test("preserves notification details for mentioned recipients", async () => {
    setDelivery({
      conversation: GROUP_CONVERSATION,
      subscriptions: [
        createSubscription(1),
        createSubscription(2, {
          is_mentioned: true,
        }),
      ],
    });

    await execute();

    const standard = getNotification(0);
    const mention = getNotification(1);

    expect(mention).toEqual({
      ...standard,
      title: "Alex Morgan mentioned you in Music Group",
    });
  });

  test.each([false, null, undefined, "true", 1])(
    "requires a boolean mention flag, not %p",
    async (isMentioned) => {
      setDelivery({
        conversation: GROUP_CONVERSATION,
        subscriptions: [
          createSubscription(1, {
            is_mentioned: isMentioned,
          }),
        ],
      });

      await execute();

      expect(getNotification().title)
        .toBe("Alex Morgan · Music Group");
    }
  );

  test("limits mention title length", async () => {
    setDelivery({
      conversation: {
        type: "group",
        name: "G".repeat(200),
      },
      subscriptions: [
        createSubscription(1, {
          is_mentioned: true,
        }),
      ],
    });

    await execute();

    expect(getNotification().title)
      .toHaveLength(120);
  });
});

/* -------------------- SUBSCRIPTIONS -------------------- */

describe("Push delivery - subscriptions", () => {
  test("returns success when there are no recipients", async () => {
    setDelivery({
      sender: null,
      subscriptions: [],
    });

    const result = await execute();

    expect(result.status).toBe(200);

    expect(result.body).toEqual({
      success: true,
      sent: 0,
      failed: 0,
      expired: 0,
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);

    expect(mockSendWebPush)
      .not.toHaveBeenCalled();

    expect(mockFrom).not.toHaveBeenCalled();
  });

  test("delivers to multiple subscriptions", async () => {
    const subscriptions = [
      createSubscription(1),
      createSubscription(2),
      createSubscription(3),
    ];

    setDelivery({ subscriptions });

    const result = await execute();

    expect(result.body.sent).toBe(3);

    expect(mockSendWebPush)
      .toHaveBeenCalledTimes(3);

    for (const subscription of subscriptions) {
      expect(mockSendWebPush)
        .toHaveBeenCalledWith(
          subscription,
          expect.any(String)
        );
    }

    expect(mockRpc).toHaveBeenCalledTimes(1);

    expect(mockFrom).not.toHaveBeenCalled();
  });

  test("does not deliver to unsupported endpoints", async () => {
    setDelivery({
      subscriptions: [
        createSubscription(1, {
          endpoint: "https://example.com/test",
        }),
      ],
    });

    mockIsValidPushEndpoint.mockReturnValue(false);

    const result = await execute();

    expect(result.status).toBe(503);

    expect(result.body).toEqual({
      success: false,
      sent: 0,
      failed: 1,
      expired: 0,
    });

    expect(mockIsValidPushEndpoint)
      .toHaveBeenCalledWith(
        "https://example.com/test"
      );

    expect(mockSendWebPush)
      .not.toHaveBeenCalled();

    expect(mockFrom).not.toHaveBeenCalled();
  });

  test("continues delivering to valid endpoints", async () => {
    const valid = createSubscription(1);

    const invalid = createSubscription(2, {
      endpoint: "https://example.com/test",
    });

    setDelivery({
      subscriptions: [valid, invalid],
    });

    mockIsValidPushEndpoint.mockImplementation(
      (endpoint) => endpoint === valid.endpoint
    );

    const result = await execute();

    expect(result.status).toBe(503);

    expect(result.body).toEqual({
      success: false,
      sent: 1,
      failed: 1,
      expired: 0,
    });

    expect(mockSendWebPush)
      .toHaveBeenCalledTimes(1);

    expect(mockSendWebPush)
      .toHaveBeenCalledWith(
        valid,
        expect.any(String)
      );
  });
});

/* -------------------- EXPIRED SUBSCRIPTIONS -------------------- */

describe("Push delivery - expired subscriptions", () => {
  test.each([404, 410])(
    "removes subscriptions returning %i",
    async (statusCode) => {
      const subscription = createSubscription();

      setDelivery({
        subscriptions: [subscription],
      });

      mockSendWebPush.mockRejectedValueOnce(
        createPushError(statusCode)
      );

      const result = await execute();

      expect(result.status).toBe(200);

      expect(result.body).toEqual({
        success: true,
        sent: 0,
        failed: 0,
        expired: 1,
      });

      expect(mockFrom).toHaveBeenCalledWith(
        "push_subscriptions"
      );

      expect(mockDelete)
        .toHaveBeenCalledTimes(1);

      expect(mockIn).toHaveBeenCalledWith(
        "id",
        [subscription.id]
      );
    }
  );

  test("removes multiple expired subscriptions in one operation", async () => {
    const subscriptions = [
      createSubscription(1),
      createSubscription(2),
      createSubscription(3),
    ];

    setDelivery({ subscriptions });

    mockSendWebPush
      .mockRejectedValueOnce(createPushError(404))
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(createPushError(410));

    const result = await execute();

    expect(result.body).toEqual({
      success: true,
      sent: 1,
      failed: 0,
      expired: 2,
    });

    expect(mockFrom).toHaveBeenCalledTimes(1);

    expect(mockDelete).toHaveBeenCalledTimes(1);

    expect(mockIn).toHaveBeenCalledTimes(1);

    expect(mockIn).toHaveBeenCalledWith(
      "id",
      [
        subscriptions[0].id,
        subscriptions[2].id,
      ]
    );
  });

  test("logs cleanup errors without discarding delivery results", async () => {
    mockSendWebPush.mockRejectedValueOnce(
      createPushError(410)
    );

    mockIn.mockResolvedValue({
      error: {
        message: "Cleanup failed",
      },
    });

    const result = await execute();

    expect(result.status).toBe(200);

    expect(result.body.expired).toBe(1);

    expect(errorSpy).toHaveBeenCalledWith(
      "[Push] Expired subscription cleanup failed:",
      "Cleanup failed"
    );
  });
});

/* -------------------- DELIVERY FAILURES -------------------- */

describe("Push delivery - failures", () => {
  test.each([400, 401, 403, 429, 500, 503])(
    "preserves subscriptions after delivery error %i",
    async (statusCode) => {
      mockSendWebPush.mockRejectedValueOnce(
        createPushError(statusCode)
      );

      const result = await execute();

      expect(result.status).toBe(503);

      expect(result.body).toEqual({
        success: false,
        sent: 0,
        failed: 1,
        expired: 0,
      });

      expect(mockFrom).not.toHaveBeenCalled();
    }
  );

  test("handles errors without a status code", async () => {
    mockSendWebPush.mockRejectedValueOnce(
      new Error("Network unavailable")
    );

    const result = await execute();

    expect(result.status).toBe(503);

    expect(result.body.failed).toBe(1);

    expect(result.body.expired).toBe(0);

    expect(mockFrom).not.toHaveBeenCalled();
  });

  test("returns accurate counts for mixed delivery results", async () => {
    const subscriptions = [
      createSubscription(1),
      createSubscription(2),
      createSubscription(3),
      createSubscription(4),
    ];

    setDelivery({ subscriptions });

    mockSendWebPush
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(createPushError(410))
      .mockRejectedValueOnce(createPushError(503))
      .mockResolvedValueOnce({ statusCode: 201 });

    const result = await execute();

    expect(result.status).toBe(503);

    expect(result.body).toEqual({
      success: false,
      sent: 2,
      failed: 1,
      expired: 1,
    });

    expect(mockIn).toHaveBeenCalledWith(
      "id",
      [subscriptions[1].id]
    );
  });
});

/* -------------------- BATCHING -------------------- */

describe("Push delivery - batching", () => {
  test("delivers more than one batch", async () => {
    const subscriptions = Array.from(
      { length: 25 },
      (_, index) => createSubscription(index + 1)
    );

    setDelivery({ subscriptions });

    const result = await execute();

    expect(result.status).toBe(200);

    expect(result.body).toEqual({
      success: true,
      sent: 25,
      failed: 0,
      expired: 0,
    });

    expect(mockSendWebPush)
      .toHaveBeenCalledTimes(25);

    expect(mockRpc).toHaveBeenCalledTimes(1);

    expect(mockFrom).not.toHaveBeenCalled();
  });

  test("limits concurrent delivery to ten subscriptions", async () => {
    const subscriptions = Array.from(
      { length: 25 },
      (_, index) => createSubscription(index + 1)
    );

    setDelivery({ subscriptions });

    let active = 0;
    let peak = 0;

    mockSendWebPush.mockImplementation(async () => {
      active++;

      peak = Math.max(peak, active);

      try {
        await Promise.resolve();

        return { statusCode: 201 };
      } finally {
        active--;
      }
    });

    const result = await execute();

    expect(result.body.sent).toBe(25);

    expect(peak).toBe(10);

    expect(active).toBe(0);
  });

  test("waits for the first batch before starting the next", async () => {
    const subscriptions = Array.from(
      { length: 12 },
      (_, index) => createSubscription(index + 1)
    );

    setDelivery({ subscriptions });

    const firstBatch = deferred();
    const firstBatchStarted = deferred();

    let started = 0;

    mockSendWebPush.mockImplementation(() => {
      started++;

      if (started === 10) {
        firstBatchStarted.resolve();
      }

      if (started <= 10) {
        return firstBatch.promise;
      }

      return Promise.resolve({
        statusCode: 201,
      });
    });

    const request = execute();

    try {
      await firstBatchStarted.promise;

      expect(mockSendWebPush)
        .toHaveBeenCalledTimes(10);

      expect(mockFrom).not.toHaveBeenCalled();
    } finally {
      firstBatch.resolve({
        statusCode: 201,
      });
    }

    const result = await request;

    expect(mockSendWebPush)
      .toHaveBeenCalledTimes(12);

    expect(result.body.sent).toBe(12);
  });
});

/* -------------------- RESPONSE HEADERS -------------------- */

describe("Push delivery - response headers", () => {
  test("prevents caching successful responses", async () => {
    const result = await execute();

    expect(result.headers.get("cache-control"))
      .toBe("no-store");
  });

  test("prevents caching unauthorized responses", async () => {
    const result = await execute(EVENT, null);

    expect(result.headers.get("cache-control"))
      .toBe("no-store");
  });

  test("prevents caching error responses", async () => {
    mockRpc.mockRejectedValue(
      new Error("Database unavailable")
    );

    const result = await execute();

    expect(result.status).toBe(500);

    expect(result.headers.get("cache-control"))
      .toBe("no-store");
  });
});