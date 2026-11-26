// src/__tests__/typing.test.js

/** @jest-environment node */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";

/* -------------------- SUPABASE MOCKS -------------------- */

const mockSetAuth = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();

const mockOn = jest.fn();
const mockSubscribe = jest.fn();
const mockSend = jest.fn();

const channel = {
  on: mockOn,
  subscribe: mockSubscribe,
  send: mockSend,
};

const mockSupabase = {
  realtime: {
    setAuth: mockSetAuth,
  },

  channel: mockChannel,
  removeChannel: mockRemoveChannel,
};

const mockCreateClient = jest.fn(
  () => mockSupabase
);

jest.doMock("@/lib/supabase/client", () => ({
  createClient: mockCreateClient,
}));

/* -------------------- LOAD SERVICE -------------------- */

const { createTypingChannel } =
  require("@/lib/extras/typing");

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

/* -------------------- CALLBACKS -------------------- */

let broadcastHandler;
let statusHandler;

let mockOnTyping;
let mockOnStatus;

let activeChannels;
let warnSpy;

/* -------------------- HELPERS -------------------- */

async function connect(overrides = {}) {
  const connection = await createTypingChannel({
    conversationId: CHAT_A,
    userId: USER_A,
    onTyping: mockOnTyping,
    onStatus: mockOnStatus,
    ...overrides,
  });

  activeChannels.push(connection);

  return connection;
}

function emitStatus(status, error) {
  statusHandler?.(status, error);
}

function emitTyping(payload) {
  broadcastHandler?.({ payload });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

/* -------------------- SETUP -------------------- */

beforeEach(() => {
  jest.resetAllMocks();

  broadcastHandler = null;
  statusHandler = null;

  activeChannels = [];

  mockOnTyping = jest.fn();
  mockOnStatus = jest.fn();

  mockCreateClient.mockReturnValue(mockSupabase);

  mockSetAuth.mockResolvedValue(undefined);
  mockChannel.mockReturnValue(channel);
  mockRemoveChannel.mockResolvedValue("ok");
  mockSend.mockResolvedValue("ok");

  mockOn.mockImplementation(
    (type, filter, callback) => {
      broadcastHandler = callback;

      return channel;
    }
  );

  mockSubscribe.mockImplementation((callback) => {
    statusHandler = callback;

    return channel;
  });

  warnSpy = jest
    .spyOn(console, "warn")
    .mockImplementation(() => {});
});

afterEach(async () => {
  for (const connection of activeChannels) {
    connection.close();
  }

  await flushPromises();

  warnSpy.mockRestore();
});

/* -------------------- CHANNEL CREATION -------------------- */

describe("Channel creation", () => {
  test("creates a typing channel", async () => {
    const connection = await connect();

    expect(connection.broadcast).toEqual(
      expect.any(Function)
    );

    expect(connection.close).toEqual(
      expect.any(Function)
    );
  });

  test("authenticates Realtime before creating the channel", async () => {
    await connect();

    expect(mockSetAuth).toHaveBeenCalledTimes(1);

    expect(
      mockSetAuth.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockChannel.mock.invocationCallOrder[0]
    );
  });

  test("uses the correct conversation topic", async () => {
    await connect();

    expect(mockChannel).toHaveBeenCalledWith(
      `typing:${CHAT_A}`,
      expect.any(Object)
    );
  });

  test("creates a private Realtime channel", async () => {
    await connect();

    expect(mockChannel).toHaveBeenCalledWith(
      `typing:${CHAT_A}`,
      {
        config: {
          private: true,

          broadcast: {
            self: false,
            ack: false,
          },
        },
      }
    );
  });

  test("uses the requested conversation ID", async () => {
    await connect({
      conversationId: CHAT_B,
    });

    expect(mockChannel).toHaveBeenCalledWith(
      `typing:${CHAT_B}`,
      expect.any(Object)
    );
  });

  test("registers the typing broadcast listener", async () => {
    await connect();

    expect(mockOn).toHaveBeenCalledWith(
      "broadcast",
      {
        event: "typing",
      },
      expect.any(Function)
    );
  });

  test("subscribes to the channel", async () => {
    await connect();

    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });
});

/* -------------------- VALIDATION -------------------- */

describe("Channel validation", () => {
  test("rejects a missing conversation ID", async () => {
    await expect(
      connect({
        conversationId: null,
      })
    ).rejects.toThrow();

    expect(mockChannel).not.toHaveBeenCalled();
  });

  test("rejects a missing user ID", async () => {
    await expect(
      connect({
        userId: null,
      })
    ).rejects.toThrow();

    expect(mockChannel).not.toHaveBeenCalled();
  });

  test("rejects an empty conversation ID", async () => {
    await expect(
      connect({
        conversationId: "",
      })
    ).rejects.toThrow();

    expect(mockChannel).not.toHaveBeenCalled();
  });

  test("rejects an empty user ID", async () => {
    await expect(
      connect({
        userId: "",
      })
    ).rejects.toThrow();

    expect(mockChannel).not.toHaveBeenCalled();
  });

  test("does not create a channel when authentication fails", async () => {
    mockSetAuth.mockRejectedValue(
      new Error("Authentication failed")
    );

    await expect(connect()).rejects.toThrow(
      "Authentication failed"
    );

    expect(mockChannel).not.toHaveBeenCalled();
  });
});

/* -------------------- CONNECTION STATUS -------------------- */

describe("Connection status", () => {
  test("reports a successful connection", async () => {
    await connect();

    emitStatus("SUBSCRIBED");

    expect(mockOnStatus).toHaveBeenCalledWith(
      true
    );
  });

  test("reports a disconnected channel", async () => {
    await connect();

    emitStatus("SUBSCRIBED");
    emitStatus("CLOSED");

    expect(mockOnStatus).toHaveBeenLastCalledWith(
      false
    );
  });

  test("reports a channel error", async () => {
    await connect();

    emitStatus(
      "CHANNEL_ERROR",
      new Error("Connection failed")
    );

    expect(mockOnStatus).toHaveBeenCalledWith(
      false
    );

    expect(warnSpy).toHaveBeenCalled();
  });

  test("reports a connection timeout", async () => {
    await connect();

    emitStatus("TIMED_OUT");

    expect(mockOnStatus).toHaveBeenCalledWith(
      false
    );

    expect(warnSpy).toHaveBeenCalled();
  });

  test("supports reconnecting after disconnection", async () => {
    const connection = await connect();

    emitStatus("SUBSCRIBED");
    emitStatus("CLOSED");
    emitStatus("SUBSCRIBED");

    connection.broadcast(true);

    expect(mockSend).toHaveBeenCalledTimes(1);

    expect(mockOnStatus).toHaveBeenLastCalledWith(
      true
    );
  });
});

/* -------------------- OUTGOING EVENTS -------------------- */

describe("Outgoing typing events", () => {
  test("broadcasts a typing event", async () => {
    const connection = await connect();

    emitStatus("SUBSCRIBED");

    connection.broadcast(true);

    expect(mockSend).toHaveBeenCalledWith({
      type: "broadcast",
      event: "typing",

      payload: {
        userId: USER_A,
        typing: true,
      },
    });
  });

  test("broadcasts a stopped typing event", async () => {
    const connection = await connect();

    emitStatus("SUBSCRIBED");

    connection.broadcast(false);

    expect(mockSend).toHaveBeenCalledWith({
      type: "broadcast",
      event: "typing",

      payload: {
        userId: USER_A,
        typing: false,
      },
    });
  });

  test("does not broadcast before subscription completes", async () => {
    const connection = await connect();

    connection.broadcast(true);

    expect(mockSend).not.toHaveBeenCalled();
  });

  test("does not broadcast after disconnection", async () => {
    const connection = await connect();

    emitStatus("SUBSCRIBED");
    emitStatus("CLOSED");

    connection.broadcast(true);

    expect(mockSend).not.toHaveBeenCalled();
  });

  test("does not broadcast after a channel error", async () => {
    const connection = await connect();

    emitStatus("SUBSCRIBED");
    emitStatus("CHANNEL_ERROR");

    connection.broadcast(true);

    expect(mockSend).not.toHaveBeenCalled();
  });

  test("does not broadcast after a timeout", async () => {
    const connection = await connect();

    emitStatus("SUBSCRIBED");
    emitStatus("TIMED_OUT");

    connection.broadcast(true);

    expect(mockSend).not.toHaveBeenCalled();
  });

  test.each([
    null,
    undefined,
    0,
    1,
    "true",
    "false",
    {},
    [],
  ])("rejects invalid typing value: %p", async (value) => {
    const connection = await connect();

    emitStatus("SUBSCRIBED");

    connection.broadcast(value);

    expect(mockSend).not.toHaveBeenCalled();
  });

  test("uses the authenticated user's supplied ID", async () => {
    const connection = await connect({
      userId: USER_C,
    });

    emitStatus("SUBSCRIBED");

    connection.broadcast(true);

    expect(mockSend).toHaveBeenCalledWith({
      type: "broadcast",
      event: "typing",

      payload: {
        userId: USER_C,
        typing: true,
      },
    });
  });
});

/* -------------------- INCOMING EVENTS -------------------- */

describe("Incoming typing events", () => {
  test("receives a valid typing event", async () => {
    await connect();

    emitStatus("SUBSCRIBED");

    emitTyping({
      userId: USER_B,
      typing: true,
    });

    expect(mockOnTyping).toHaveBeenCalledWith({
      userId: USER_B,
      typing: true,
    });
  });

  test("receives a stopped typing event", async () => {
    await connect();

    emitStatus("SUBSCRIBED");

    emitTyping({
      userId: USER_B,
      typing: false,
    });

    expect(mockOnTyping).toHaveBeenCalledWith({
      userId: USER_B,
      typing: false,
    });
  });

  test("receives typing events from multiple users", async () => {
    await connect();

    emitStatus("SUBSCRIBED");

    emitTyping({
      userId: USER_B,
      typing: true,
    });

    emitTyping({
      userId: USER_C,
      typing: true,
    });

    expect(mockOnTyping).toHaveBeenCalledTimes(2);

    expect(mockOnTyping).toHaveBeenNthCalledWith(
      1,
      {
        userId: USER_B,
        typing: true,
      }
    );

    expect(mockOnTyping).toHaveBeenNthCalledWith(
      2,
      {
        userId: USER_C,
        typing: true,
      }
    );
  });

  test("ignores events from the current user", async () => {
    await connect();

    emitStatus("SUBSCRIBED");

    emitTyping({
      userId: USER_A,
      typing: true,
    });

    expect(mockOnTyping).not.toHaveBeenCalled();
  });

  test.each([
    null,
    undefined,
    {},
    [],
    "invalid",
    123,

    {
      userId: "invalid",
      typing: true,
    },

    {
      userId: USER_B,
    },

    {
      typing: true,
    },

    {
      userId: USER_B,
      typing: "true",
    },

    {
      userId: USER_B,
      typing: 1,
    },

    {
      userId: USER_B,
      typing: null,
    },

    {
      userId: null,
      typing: true,
    },
  ])("ignores malformed payload: %p", async (payload) => {
    await connect();

    emitStatus("SUBSCRIBED");

    emitTyping(payload);

    expect(mockOnTyping).not.toHaveBeenCalled();
  });

  test("removes unrelated payload properties", async () => {
    await connect();

    emitStatus("SUBSCRIBED");

    emitTyping({
      userId: USER_B,
      typing: true,
      username: "unexpected",
      admin: true,
    });

    expect(mockOnTyping).toHaveBeenCalledWith({
      userId: USER_B,
      typing: true,
    });
  });

  test("supports an omitted typing callback", async () => {
    await connect({
      onTyping: undefined,
    });

    expect(() => {
      emitTyping({
        userId: USER_B,
        typing: true,
      });
    }).not.toThrow();
  });

  test("supports an omitted status callback", async () => {
    await connect({
      onStatus: undefined,
    });

    expect(() => {
      emitStatus("SUBSCRIBED");
    }).not.toThrow();
  });
});

/* -------------------- BROADCAST ERRORS -------------------- */

describe("Broadcast error handling", () => {
  test("handles rejected broadcast requests", async () => {
    mockSend.mockRejectedValue(
      new Error("Network error")
    );

    const connection = await connect();

    emitStatus("SUBSCRIBED");

    expect(() => {
      connection.broadcast(true);
    }).not.toThrow();

    await flushPromises();

    expect(warnSpy).toHaveBeenCalled();
  });

  test("handles unsuccessful broadcast responses", async () => {
    mockSend.mockResolvedValue("error");

    const connection = await connect();

    emitStatus("SUBSCRIBED");

    connection.broadcast(true);

    await flushPromises();

    expect(warnSpy).toHaveBeenCalled();
  });

  test("handles broadcast timeouts", async () => {
    mockSend.mockResolvedValue("timed out");

    const connection = await connect();

    emitStatus("SUBSCRIBED");

    connection.broadcast(true);

    await flushPromises();

    expect(warnSpy).toHaveBeenCalled();
  });

  test("does not warn after successful broadcasts", async () => {
    const connection = await connect();

    emitStatus("SUBSCRIBED");

    connection.broadcast(true);

    await flushPromises();

    expect(warnSpy).not.toHaveBeenCalled();
  });
});

/* -------------------- CLEANUP -------------------- */

describe("Channel cleanup", () => {
  test("removes the Realtime channel", async () => {
    const connection = await connect();

    connection.close();

    expect(mockRemoveChannel).toHaveBeenCalledWith(
      channel
    );
  });

  test("broadcasts stopped typing before closing", async () => {
    const connection = await connect();

    emitStatus("SUBSCRIBED");

    connection.close();

    expect(mockSend).toHaveBeenCalledWith({
      type: "broadcast",
      event: "typing",

      payload: {
        userId: USER_A,
        typing: false,
      },
    });

    expect(
      mockSend.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockRemoveChannel.mock.invocationCallOrder[0]
    );
  });

  test("does not broadcast when closing an unconnected channel", async () => {
    const connection = await connect();

    connection.close();

    expect(mockSend).not.toHaveBeenCalled();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(
      1
    );
  });

  test("supports repeated cleanup calls", async () => {
    const connection = await connect();

    emitStatus("SUBSCRIBED");

    connection.close();
    connection.close();
    connection.close();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(
      1
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test("ignores outgoing broadcasts after cleanup", async () => {
    const connection = await connect();

    emitStatus("SUBSCRIBED");

    connection.close();

    mockSend.mockClear();

    connection.broadcast(true);
    connection.broadcast(false);

    expect(mockSend).not.toHaveBeenCalled();
  });

  test("ignores incoming broadcasts after cleanup", async () => {
    const connection = await connect();

    emitStatus("SUBSCRIBED");

    connection.close();

    emitTyping({
      userId: USER_B,
      typing: true,
    });

    expect(mockOnTyping).not.toHaveBeenCalled();
  });

  test("ignores status changes after cleanup", async () => {
    const connection = await connect();

    connection.close();

    mockOnStatus.mockClear();

    emitStatus("SUBSCRIBED");
    emitStatus("CHANNEL_ERROR");
    emitStatus("CLOSED");

    expect(mockOnStatus).not.toHaveBeenCalled();
  });

  test("cannot reconnect a closed connection", async () => {
    const connection = await connect();

    connection.close();

    emitStatus("SUBSCRIBED");

    connection.broadcast(true);

    expect(mockSend).not.toHaveBeenCalled();
  });
});