/** @jest-environment node */

// src/__tests__/pushSend.test.js

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";

/* -------------------- CONSTANTS -------------------- */

const WEBHOOK_SECRET = "test-webhook-secret";
const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";
const SENDER_ID = "33333333-3333-4333-8333-333333333333";
const SUBSCRIPTION_ID = "44444444-4444-4444-8444-444444444444";
const SECOND_SUBSCRIPTION_ID = "55555555-5555-4555-8555-555555555555";

const MESSAGE = {
  id: MESSAGE_ID,
  conversation_id: CONVERSATION_ID,
  sender_id: SENDER_ID,
  content: "Hello there",
  gif_id: null,
  attachment_type: null,
  attachment_name: null,
};

const SENDER = {
  display_name: "Alex Morgan",
  username: "alex",
};

const SUBSCRIPTION = {
  id: SUBSCRIPTION_ID,
  endpoint: "https://push.example.com/device-1",
  p256dh: "test-public-key",
  auth_key: "test-auth-key",
};

const SECOND_SUBSCRIPTION = {
  id: SECOND_SUBSCRIPTION_ID,
  endpoint: "https://push.example.com/device-2",
  p256dh: "second-public-key",
  auth_key: "second-auth-key",
};

/* -------------------- SUPABASE MOCKS -------------------- */

const mockFrom = jest.fn();
const mockRpc = jest.fn();

const mockMessageSelect = jest.fn();
const mockMessageEq = jest.fn();
const mockMessageMaybeSingle = jest.fn();

const mockProfileSelect = jest.fn();
const mockProfileEq = jest.fn();
const mockProfileMaybeSingle = jest.fn();

const mockDelete = jest.fn();
const mockDeleteIn = jest.fn();

const mockAdmin = {
  from: mockFrom,
  rpc: mockRpc,
};

const mockCreateAdminClient = jest.fn(() => mockAdmin);

jest.doMock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

/* -------------------- WEB PUSH MOCK -------------------- */

const mockSendWebPush = jest.fn();

jest.doMock("@/lib/webPush", () => ({
  sendWebPush: mockSendWebPush,
}));

/* -------------------- PREVIEW MOCK -------------------- */

const mockGetNotificationPreview = jest.fn();

jest.doMock("@/utils/notificationPreview", () => ({
  getNotificationPreview:
    mockGetNotificationPreview,
}));

/* -------------------- LOAD ROUTE -------------------- */

const { POST } = require("@/app/api/push/send/route");

/* -------------------- HELPERS -------------------- */

let previousSecret;
let errorSpy;
let warnSpy;

function createEvent(overrides = {}) {
  return {
    type: "INSERT",
    table: "messages",
    schema: "public",

    record: {
      id: MESSAGE_ID,
    },

    ...overrides,
  };
}

function createRequest({
  event = createEvent(),
  authorization = `Bearer ${WEBHOOK_SECRET}`,
  rawBody,
} = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (authorization !== null) {
    headers.Authorization = authorization;
  }

  return new Request("http://localhost/api/push/send",
    {
      method: "POST",
      headers,
      body:
        rawBody !== undefined
          ? rawBody
          : JSON.stringify(event),
    }
  );
}

async function execute(options) {
  const response = await POST(createRequest(options));

  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}

function createPushError(statusCode) {
  return Object.assign(new Error(`Push error ${statusCode}`), { statusCode });
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

async function flushPromises(count = 20) {
  for (let index = 0; index < count; index++) {
    await Promise.resolve();
  }
}

/* -------------------- SETUP -------------------- */

beforeEach(() => {
  jest.resetAllMocks();

  previousSecret = process.env.PUSH_WEBHOOK_SECRET;
  process.env.PUSH_WEBHOOK_SECRET = WEBHOOK_SECRET;

  mockCreateAdminClient.mockReturnValue(mockAdmin);

  mockMessageSelect.mockReturnValue({
    eq: mockMessageEq,
  });

  mockMessageEq.mockReturnValue({
    maybeSingle: mockMessageMaybeSingle,
  });

  mockMessageMaybeSingle.mockResolvedValue({
    data: MESSAGE,
    error: null,
  });

  mockProfileSelect.mockReturnValue({
    eq: mockProfileEq,
  });

  mockProfileEq.mockReturnValue({
    maybeSingle: mockProfileMaybeSingle,
  });

  mockProfileMaybeSingle.mockResolvedValue({
    data: SENDER,
    error: null,
  });

  mockDelete.mockReturnValue({
    in: mockDeleteIn,
  });

  mockDeleteIn.mockResolvedValue({
    error: null,
  });

  mockFrom.mockImplementation((table) => {
    if (table === "messages") {
      return {
        select: mockMessageSelect,
      };
    }

    if (table === "profiles") {
      return {
        select: mockProfileSelect,
      };
    }

    if (table === "push_subscriptions") {
      return {
        delete: mockDelete,
      };
    }

    throw new Error(
      `Unexpected table: ${table}`
    );
  });

  mockRpc.mockResolvedValue({
    data: [SUBSCRIPTION],
    error: null,
  });

  mockSendWebPush.mockResolvedValue(undefined);
  mockGetNotificationPreview.mockReturnValue("Hello there");

  errorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});

  warnSpy = jest
    .spyOn(console, "warn")
    .mockImplementation(() => {});
});

afterEach(() => {
  if (previousSecret === undefined) {
    delete process.env.PUSH_WEBHOOK_SECRET;
  } else {
    process.env.PUSH_WEBHOOK_SECRET = previousSecret;
  }

  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

/* -------------------- WEBHOOK AUTHENTICATION -------------------- */

describe("Webhook authentication", () => {
  test("accepts the correct webhook secret", async () => {
    const result = await execute();
    expect(result.status).toBe(200);
  });

  test("rejects missing authorization", async () => {
    const result = await execute({
      authorization: null,
    });

    expect(result.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  test("rejects an incorrect secret", async () => {
    const result = await execute({
      authorization: "Bearer incorrect-secret",
    });

    expect(result.status).toBe(401);
  });

  test("rejects an empty secret", async () => {
    const result = await execute({
      authorization: "Bearer ",
    });

    expect(result.status).toBe(401);
  });

  test("rejects unsupported authentication schemes", async () => {
    const result = await execute({
      authorization: `Basic ${WEBHOOK_SECRET}`,
    });

    expect(result.status).toBe(401);
  });

  test("accepts case-insensitive Bearer authentication", async () => {
    const result = await execute({
      authorization: `bearer ${WEBHOOK_SECRET}`,
    });

    expect(result.status).toBe(200);
  });

  test("rejects secrets with different lengths", async () => {
    const result = await execute({
      authorization: "Bearer x",
    });

    expect(result.status).toBe(401);
  });

  test("rejects incorrect secrets with equal lengths", async () => {
    const result = await execute({
      authorization: `Bearer ${"x".repeat(WEBHOOK_SECRET.length)}`,
    });

    expect(result.status).toBe(401);
  });

  test("fails securely when the server secret is missing", async () => {
    delete process.env.PUSH_WEBHOOK_SECRET;
    const result = await execute();

    expect(result.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  test("does not access the database for unauthorized requests", async () => {
    await execute({
      authorization: "Bearer invalid",
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockSendWebPush).not.toHaveBeenCalled();
  });
});

/* -------------------- EVENT VALIDATION -------------------- */

describe("Webhook event validation", () => {
  test("rejects malformed JSON", async () => {
    const result = await execute({
      rawBody: "{invalid-json",
    });

    expect(result.status).toBe(400);
  });

  test("rejects a null event", async () => {
    const result = await execute({
      event: null,
    });

    expect(result.status).toBe(400);
  });

  test("rejects an empty event", async () => {
    const result = await execute({
      event: {},
    });

    expect(result.status).toBe(400);
  });

  test.each([
    "UPDATE",
    "DELETE",
    "SELECT",
  ])("rejects unsupported event type: %s", async (type) => {
    const result = await execute({
      event: createEvent({
        type,
      }),
    });

    expect(result.status).toBe(400);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  test("rejects events from unrelated tables", async () => {
    const result = await execute({
      event: createEvent({
        table: "profiles",
      }),
    });

    expect(result.status).toBe(400);
  });

  test("rejects events from unrelated schemas", async () => {
    const result = await execute({
      event: createEvent({
        schema: "private",
      }),
    });

    expect(result.status).toBe(400);
  });

  test("rejects a missing record", async () => {
    const result = await execute({
      event: createEvent({
        record: null,
      }),
    });

    expect(result.status).toBe(400);
  });

  test.each([
    null,
    undefined,
    "",
    "invalid",
    123,
    {},
    [],
  ])("rejects invalid message ID: %p", async (id) => {
    const result = await execute({
      event: createEvent({
        record: {
          id,
        },
      }),
    });

    expect(result.status).toBe(400);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
});

/* -------------------- MESSAGE RETRIEVAL -------------------- */

describe("Message retrieval", () => {
  test("retrieves the message from the database", async () => {
    await execute();

    expect(mockFrom).toHaveBeenCalledWith("messages");
    expect(mockMessageEq).toHaveBeenCalledWith("id", MESSAGE_ID);
  });

  test("returns 404 when the message does not exist", async () => {
    mockMessageMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await execute();

    expect(result.status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();

    expect(mockSendWebPush).not.toHaveBeenCalled();
  });

  test("handles message retrieval errors", async () => {
    mockMessageMaybeSingle.mockResolvedValue({
      data: null,
      error: new Error("Database unavailable"),
    });

    const result = await execute();

    expect(result.status).toBe(500);
    expect(mockSendWebPush).not.toHaveBeenCalled();
  });

  test("uses trusted database content instead of webhook content", async () => {
    await execute({
      event: createEvent({
        record: {
          id: MESSAGE_ID,
          content: "Untrusted webhook content",
          sender_id: "untrusted-sender",
          conversation_id: "untrusted-chat",
        },
      }),
    });

    expect(mockGetNotificationPreview).toHaveBeenCalledWith(MESSAGE);
    expect(mockProfileEq).toHaveBeenCalledWith("id", SENDER_ID);
  });
});

/* -------------------- SUBSCRIPTION ELIGIBILITY -------------------- */

describe("Notification eligibility", () => {
  test("uses the authoritative eligibility RPC", async () => {
    await execute();

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("get_message_push_subscriptions", { target_message_id: MESSAGE_ID });
  });

  test("does not send when no subscriptions are eligible", async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await execute();

    expect(result.status).toBe(200);

    expect(result.body).toEqual({
      success: true,
      sent: 0,
      failed: 0,
      expired: 0,
    });

    expect(mockSendWebPush).not.toHaveBeenCalled();
  });

  test("does not retrieve the sender when no subscriptions are eligible", async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    await execute();

    expect(mockFrom).not.toHaveBeenCalledWith("profiles");
  });

  test("does not build a notification when no subscriptions are eligible", async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    await execute();

    expect(mockGetNotificationPreview).not.toHaveBeenCalled();
  });

  test("does not bypass the eligibility RPC by directly selecting subscriptions", async () => {
    await execute();

    expect(mockFrom).not.toHaveBeenCalledWith("push_subscriptions");
  });

  test("fails securely when eligibility retrieval fails", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error("Eligibility check failed"),
    });

    const result = await execute();

    expect(result.status).toBe(500);

    expect(mockSendWebPush).not.toHaveBeenCalled();
  });

  test.each([
    null,
    {},
    "invalid",
    123,
  ])("rejects invalid eligibility responses: %p", async (data) => {
    mockRpc.mockResolvedValue({
      data,
      error: null,
    });

    const result = await execute();

    expect(result.status).toBe(500);

    expect(mockSendWebPush).not.toHaveBeenCalled();
  });
});

/* -------------------- NOTIFICATION CONTENT -------------------- */

describe("Notification content", () => {
  test("retrieves the sender profile", async () => {
    await execute();

    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockProfileEq).toHaveBeenCalledWith("id", SENDER_ID);
  });

  test("constructs the correct notification", async () => {
    await execute();

    expect(mockSendWebPush).toHaveBeenCalledWith(
      SUBSCRIPTION,
      {
        title: "Alex Morgan sent you a message",
        body: "Hello there",
        url: `/messages/${CONVERSATION_ID}`,
        tag: `chat:${CONVERSATION_ID}`,
      }
    );
  });

  test("falls back to the username", async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: {
        display_name: null,
        username: "alex",
      },
      error: null,
    });

    await execute();

    expect(mockSendWebPush).toHaveBeenCalledWith(
      SUBSCRIPTION,
      expect.objectContaining({
        title: "alex sent you a message",
      })
    );
  });

  test("ignores whitespace-only display names", async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: {
        display_name: "   ",
        username: "alex",
      },
      error: null,
    });

    await execute();

    expect(mockSendWebPush).toHaveBeenCalledWith(
      SUBSCRIPTION,
      expect.objectContaining({
        title: "alex sent you a message",
      })
    );
  });

  test("uses a fallback when the sender has no name", async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: {
        display_name: null,
        username: null,
      },
      error: null,
    });

    await execute();

    expect(mockSendWebPush).toHaveBeenCalledWith(
      SUBSCRIPTION,
      expect.objectContaining({
        title: "Someone sent you a message",
      })
    );
  });

  test("handles a missing sender profile", async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    await execute();

    expect(mockSendWebPush).toHaveBeenCalledWith(
      SUBSCRIPTION,
      expect.objectContaining({
        title: "Someone sent you a message",
      })
    );
  });

  test("uses the generated notification preview", async () => {
    mockGetNotificationPreview.mockReturnValue("Sent a photo");

    await execute();

    expect(mockSendWebPush).toHaveBeenCalledWith(
      SUBSCRIPTION,
      expect.objectContaining({
        body: "Sent a photo",
      })
    );
  });

  test("handles sender retrieval errors", async () => {
    mockProfileMaybeSingle.mockResolvedValue({
      data: null,
      error: new Error("Profile retrieval failed"),
    });

    const result = await execute();

    expect(result.status).toBe(500);
    expect(mockSendWebPush).not.toHaveBeenCalled();
  });
});

/* -------------------- SUCCESSFUL DELIVERY -------------------- */

describe("Successful notification delivery", () => {
  test("reports one successful notification", async () => {
    const result = await execute();

    expect(result.status).toBe(200);

    expect(result.body).toEqual({
      success: true,
      sent: 1,
      failed: 0,
      expired: 0,
    });
  });

  test("delivers notifications to multiple devices", async () => {
    mockRpc.mockResolvedValue({
      data: [
        SUBSCRIPTION,
        SECOND_SUBSCRIPTION,
      ],
      error: null,
    });

    const result = await execute();

    expect(result.body).toEqual({
      success: true,
      sent: 2,
      failed: 0,
      expired: 0,
    });

    expect(mockSendWebPush
).toHaveBeenCalledTimes(2);
  });

  test("does not delete valid subscriptions", async () => {
    await execute();

    expect(mockDelete).not.toHaveBeenCalled();
  });

  test("retrieves the sender only once for multiple devices", async () => {
    mockRpc.mockResolvedValue({
      data: [
        SUBSCRIPTION,
        SECOND_SUBSCRIPTION,
      ],
      error: null,
    });

    await execute();

    expect(mockProfileMaybeSingle).toHaveBeenCalledTimes(1);
  });

  test("generates the notification preview only once", async () => {
    mockRpc.mockResolvedValue({
      data: [
        SUBSCRIPTION,
        SECOND_SUBSCRIPTION,
      ],
      error: null,
    });

    await execute();

    expect(mockGetNotificationPreview).toHaveBeenCalledTimes(1);
  });
});

/* -------------------- EXPIRED SUBSCRIPTIONS -------------------- */

describe("Expired subscription cleanup", () => {
  test.each([404, 410])(
    "removes expired subscriptions with status %s",
    async (statusCode) => {
      mockSendWebPush.mockRejectedValue(createPushError(statusCode));

      const result = await execute();

      expect(result.status).toBe(200);

      expect(result.body).toEqual({
        success: true,
        sent: 0,
        failed: 0,
        expired: 1,
      });

      expect(mockFrom).toHaveBeenCalledWith("push_subscriptions");
      expect(mockDeleteIn).toHaveBeenCalledWith("id", [SUBSCRIPTION_ID]);
    }
  );

  test("deletes multiple expired subscriptions in one request", async () => {
    mockRpc.mockResolvedValue({
      data: [
        SUBSCRIPTION,
        SECOND_SUBSCRIPTION,
      ],
      error: null,
    });

    mockSendWebPush.mockRejectedValue(createPushError(410));

    const result = await execute();

    expect(result.body.expired).toBe(2);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteIn).toHaveBeenCalledWith("id", [ SUBSCRIPTION_ID, SECOND_SUBSCRIPTION_ID ]);
  });

  test("deletes only expired subscriptions", async () => {
    mockRpc.mockResolvedValue({
      data: [
        SUBSCRIPTION,
        SECOND_SUBSCRIPTION,
      ],
      error: null,
    });

    mockSendWebPush
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(createPushError(410));

    const result = await execute();

    expect(result.body).toEqual({
      success: true,
      sent: 1,
      failed: 0,
      expired: 1,
    });

    expect(mockDeleteIn).toHaveBeenCalledWith("id", [SECOND_SUBSCRIPTION_ID]);
  });

  test("handles a returned subscription cleanup error", async () => {
    mockSendWebPush.mockRejectedValue(createPushError(410));

    mockDeleteIn.mockResolvedValue({
      error: new Error("Cleanup failed"),
    });

    const result = await execute();

    expect(result.status).toBe(200);
    expect(result.body.expired).toBe(1);
  });
});

/* -------------------- DELIVERY FAILURES -------------------- */

describe("Notification delivery failures", () => {
  test.each([
    400,
    401,
    403,
    429,
    500,
    503,
  ])("preserves subscriptions after push error %s", async (statusCode) => {
    mockSendWebPush.mockRejectedValue(createPushError(statusCode));

    const result = await execute();

    expect(result.status).toBe(503);

    expect(result.body).toEqual({
      success: false,
      sent: 0,
      failed: 1,
      expired: 0,
    });

    expect(mockDelete).not.toHaveBeenCalled();
  });

  test("handles network failures", async () => {
    mockSendWebPush.mockRejectedValue(new Error("Network unavailable"));

    const result = await execute();

    expect(result.status).toBe(503);
    expect(result.body.failed).toBe(1);

    expect(mockDelete).not.toHaveBeenCalled();
  });

  test("continues delivering after an individual failure", async () => {
    mockRpc.mockResolvedValue({
      data: [
        SUBSCRIPTION,
        SECOND_SUBSCRIPTION,
      ],
      error: null,
    });

    mockSendWebPush
      .mockRejectedValueOnce(createPushError(503))
      .mockResolvedValueOnce(undefined);

    const result = await execute();

    expect(result.status).toBe(503);

    expect(result.body).toEqual({
      success: false,
      sent: 1,
      failed: 1,
      expired: 0,
    });

    expect(mockSendWebPush).toHaveBeenCalledTimes(2);
  });

  test("correctly counts mixed delivery outcomes", async () => {
    const thirdSubscription = {
      ...SUBSCRIPTION,
      id: "66666666-6666-4666-8666-666666666666",
      endpoint: "https://push.example.com/device-3",
    };

    mockRpc.mockResolvedValue({
      data: [
        SUBSCRIPTION,
        SECOND_SUBSCRIPTION,
        thirdSubscription,
      ],
      error: null,
    });

    mockSendWebPush
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(createPushError(410))
      .mockRejectedValueOnce(createPushError(503));

    const result = await execute();

    expect(result.status).toBe(503);

    expect(result.body).toEqual({
      success: false,
      sent: 1,
      failed: 1,
      expired: 1,
    });

    expect(mockDeleteIn).toHaveBeenCalledWith("id", [SECOND_SUBSCRIPTION_ID]);
  });
});

/* -------------------- DELIVERY BATCHING -------------------- */

describe("Delivery batching", () => {
  function createSubscriptions(count) {
    return Array.from(
      { length: count },
      (_, index) => ({
        ...SUBSCRIPTION,

        id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, "0")}`,
        endpoint: `https://push.example.com/device-${index}`,
      })
    );
  }

  test("delivers more than one batch of notifications", async () => {
    mockRpc.mockResolvedValue({
      data: createSubscriptions(25),
      error: null,
    });

    const result = await execute();

    expect(result.status).toBe(200);
    expect(result.body.sent).toBe(25);

    expect(mockSendWebPush).toHaveBeenCalledTimes(25);
  });

  test("limits concurrent deliveries to ten", async () => {
    mockRpc.mockResolvedValue({
      data: createSubscriptions(25),
      error: null,
    });

    let active = 0;
    let peak = 0;

    mockSendWebPush.mockImplementation(
      async () => {
        active++;

        peak = Math.max(peak, active);

        await Promise.resolve();

        active--;
      }
    );

    const result = await execute();

    expect(result.body.sent).toBe(25);

    expect(peak).toBeLessThanOrEqual(10);
    expect(peak).toBeGreaterThan(0);
  });

  test("waits for the first batch before starting the next", async () => {
    mockRpc.mockResolvedValue({
      data: createSubscriptions(15),
      error: null,
    });

    const firstBatchStarted = deferred();
    const firstBatch = deferred();

    let started = 0;

    mockSendWebPush.mockImplementation(
      async () => {
        started++;

        if (started === 10) {
          firstBatchStarted.resolve();
        }

        if (started <= 10) {
          await firstBatch.promise;
        }
      }
    );

    const operation = execute();

    try {
      await firstBatchStarted.promise;

      await flushPromises();

      expect(mockSendWebPush).toHaveBeenCalledTimes(10);
    } finally {
      firstBatch.resolve();
    }

    const result = await operation;

    expect(result.body.sent).toBe(15);

    expect(mockSendWebPush).toHaveBeenCalledTimes(15);
  });

  test("batches expired subscription deletion across delivery batches", async () => {
    const subscriptions = createSubscriptions(25);

    mockRpc.mockResolvedValue({
      data: subscriptions,
      error: null,
    });

    mockSendWebPush.mockRejectedValue(createPushError(410));

    const result = await execute();

    expect(result.body.expired).toBe(25);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteIn).toHaveBeenCalledWith("id", subscriptions.map((subscription) => subscription.id));
  });
});

/* -------------------- RESPONSE SECURITY -------------------- */

describe("Response security", () => {
  test("prevents caching successful responses", async () => {
    const result = await execute();

    expect(result.headers.get("cache-control")).toBe("no-store");
  });

  test("prevents caching unauthorized responses", async () => {
    const result = await execute({
      authorization: null,
    });

    expect(
      result.headers.get("cache-control")
    ).toBe("no-store");
  });

  test("does not expose internal database errors", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error("Sensitive internal database information"),
    });

    const result = await execute();

    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toContain("Sensitive internal database information");
  });

  test("does not expose subscription credentials", async () => {
    const result = await execute();
    const body = JSON.stringify(result.body);

    expect(body).not.toContain(SUBSCRIPTION.endpoint);
    expect(body).not.toContain(SUBSCRIPTION.p256dh);
    expect(body).not.toContain(SUBSCRIPTION.auth_key);
  });

  test("handles admin client initialization failures", async () => {
    mockCreateAdminClient.mockImplementation(() => {
        throw new Error("Admin initialization failed");
      }
    );

    const result = await execute();

    expect(result.status).toBe(500);

    expect(mockSendWebPush).not.toHaveBeenCalled();
  });
});