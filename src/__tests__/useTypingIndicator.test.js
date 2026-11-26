// src/__tests__/useTypingIndicator.test.js

/** @jest-environment jsdom */

import {
    describe,
    test,
    expect,
    jest,
    beforeEach,
    afterEach,
} from "@jest/globals";

import {
    renderHook,
    act,
    cleanup,
} from "@testing-library/react";

/* -------------------- MOCK TYPING SERVICE -------------------- */

const mockCreateTypingChannel = jest.fn();

jest.doMock("@/lib/extras/typing", () => ({
    createTypingChannel: mockCreateTypingChannel,
}));

const useTypingIndicator = require("@/hooks/useTypingIndicator").default;

/* -------------------- CONSTANTS -------------------- */

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const USER_C = "33333333-3333-4333-8333-333333333333";
const CHAT_A = "44444444-4444-4444-8444-444444444444";
const CHAT_B = "55555555-5555-4555-8555-555555555555";

const BROADCAST_INTERVAL = 1000;
const INACTIVITY_TIMEOUT = 2000;
const REMOTE_TIMEOUT = 5000;

/* -------------------- MOCK CONNECTIONS -------------------- */

let connections;
let warnSpy;
let errorSpy;

function createMockConnection(options) {
    const connection = {
        options,
        broadcast: jest.fn(),
        close: jest.fn(),
    };

    connections.push(connection);

    return connection;
}

function currentConnection() {
    return connections[connections.length - 1];
}

/* -------------------- HELPERS -------------------- */

async function flushPromises() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

async function advanceTime(milliseconds) {
    await act(async () => {
        jest.advanceTimersByTime(milliseconds);
    });
}

async function setup(overrides = {}) {
    const initialProps = {
        conversationId: CHAT_A,
        userId: USER_A,
        enabled: true,
        ...overrides,
    };

    const hook = renderHook(
        ({ conversationId, userId, enabled }) =>
            useTypingIndicator(
                conversationId,
                userId,
                { enabled }
            ),
        {
            initialProps,
        }
    );

    await flushPromises();

    return hook;
}

function connectChannel(
    connection = currentConnection()
) {
    act(() => {
        connection?.options.onStatus?.(true);
    });
}

function disconnectChannel(
    connection = currentConnection()
) {
    act(() => {
        connection?.options.onStatus?.(false);
    });
}

function receiveTyping(
    userId,
    typing,
    connection = currentConnection()
) {
    act(() => {
        connection?.options.onTyping?.({
            userId,
            typing,
        });
    });
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
    jest.useFakeTimers();

    jest.setSystemTime(
        new Date("2026-11-26T00:00:00Z")
    );

    jest.clearAllMocks();

    connections = [];

    mockCreateTypingChannel.mockReset();

    mockCreateTypingChannel.mockImplementation(
        async (options) => createMockConnection(options)
    );

    warnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => { });

    errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => { });
});

afterEach(() => {
    cleanup();

    jest.clearAllTimers();
    jest.useRealTimers();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
});

/* -------------------- INITIALIZATION -------------------- */

describe("Initialization", () => {
    test("starts without remote typing users", async () => {
        const { result } = await setup();

        expect(result.current.typingUsers).toEqual([]);
    });

    test("exposes typing controls", async () => {
        const { result } = await setup();

        expect(result.current.notifyTyping).toEqual(
            expect.any(Function)
        );

        expect(result.current.stopTyping).toEqual(
            expect.any(Function)
        );
    });

    test("creates a channel for the active conversation", async () => {
        await setup();

        expect(
            mockCreateTypingChannel
        ).toHaveBeenCalledTimes(1);

        expect(
            mockCreateTypingChannel
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                conversationId: CHAT_A,
                userId: USER_A,
            })
        );
    });

    test("registers typing and status callbacks", async () => {
        await setup();

        expect(
            mockCreateTypingChannel
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                onTyping: expect.any(Function),
                onStatus: expect.any(Function),
            })
        );
    });

    test("does not connect without a conversation", async () => {
        await setup({
            conversationId: null,
        });

        expect(
            mockCreateTypingChannel
        ).not.toHaveBeenCalled();
    });

    test("does not connect without a user", async () => {
        await setup({
            userId: null,
        });

        expect(
            mockCreateTypingChannel
        ).not.toHaveBeenCalled();
    });
});

/* -------------------- BLOCKED CONVERSATIONS -------------------- */

describe("Blocked conversation restrictions", () => {
    test("does not connect when typing is disabled", async () => {
        await setup({
            enabled: false,
        });

        expect(
            mockCreateTypingChannel
        ).not.toHaveBeenCalled();
    });

    test("does not broadcast when typing is disabled", async () => {
        const { result } = await setup({
            enabled: false,
        });

        act(() => {
            result.current.notifyTyping("Hello");
        });

        expect(
            mockCreateTypingChannel
        ).not.toHaveBeenCalled();

        expect(result.current.typingUsers).toEqual([]);
    });

    test("closes the channel when messaging becomes unavailable", async () => {
        const { rerender } = await setup();

        const connection = currentConnection();

        connectChannel(connection);

        rerender({
            conversationId: CHAT_A,
            userId: USER_A,
            enabled: false,
        });

        await flushPromises();

        expect(connection.close).toHaveBeenCalledTimes(1);
    });

    test("clears remote typing indicators when disabled", async () => {
        const { result, rerender } = await setup();

        connectChannel();

        receiveTyping(USER_B, true);

        expect(result.current.typingUsers).toContain(
            USER_B
        );

        rerender({
            conversationId: CHAT_A,
            userId: USER_A,
            enabled: false,
        });

        await flushPromises();

        expect(result.current.typingUsers).toEqual([]);
    });

    test("reconnects when messaging becomes available", async () => {
        const { rerender } = await setup({
            enabled: false,
        });

        rerender({
            conversationId: CHAT_A,
            userId: USER_A,
            enabled: true,
        });

        await flushPromises();

        expect(
            mockCreateTypingChannel
        ).toHaveBeenCalledTimes(1);
    });

    test("ignores events from a disabled channel", async () => {
        const { result, rerender } = await setup();

        const oldConnection = currentConnection();

        rerender({
            conversationId: CHAT_A,
            userId: USER_A,
            enabled: false,
        });

        await flushPromises();

        receiveTyping(
            USER_B,
            true,
            oldConnection
        );

        expect(result.current.typingUsers).toEqual([]);
    });
});

/* -------------------- LOCAL TYPING -------------------- */

describe("Local typing", () => {
    test("broadcasts typing when text is entered", async () => {
        const { result } = await setup();

        const connection = currentConnection();

        connectChannel();

        act(() => {
            result.current.notifyTyping("Hello");
        });

        expect(connection.broadcast).toHaveBeenCalledWith(
            true
        );
    });

    test("does not broadcast typing for empty text", async () => {
        const { result } = await setup();

        connectChannel();

        act(() => {
            result.current.notifyTyping("");
        });

        expect(
            currentConnection().broadcast
        ).not.toHaveBeenCalledWith(true);
    });

    test("does not broadcast typing for whitespace", async () => {
        const { result } = await setup();

        connectChannel();

        act(() => {
            result.current.notifyTyping("   ");
        });

        expect(
            currentConnection().broadcast
        ).not.toHaveBeenCalledWith(true);
    });

    test.each([
        null,
        undefined,
        123,
        true,
        {},
        [],
    ])("ignores invalid text input: %p", async (value) => {
        const { result } = await setup();

        connectChannel();

        expect(() => {
            act(() => {
                result.current.notifyTyping(value);
            });
        }).not.toThrow();

        expect(
            currentConnection().broadcast
        ).not.toHaveBeenCalledWith(true);
    });

    test("stops typing when the input is cleared", async () => {
        const { result } = await setup();

        connectChannel();

        act(() => {
            result.current.notifyTyping("Hello");
            result.current.notifyTyping("");
        });

        expect(
            currentConnection().broadcast
        ).toHaveBeenLastCalledWith(false);
    });

    test("supports manually stopping typing", async () => {
        const { result } = await setup();

        connectChannel();

        act(() => {
            result.current.notifyTyping("Hello");
            result.current.stopTyping();
        });

        expect(
            currentConnection().broadcast
        ).toHaveBeenLastCalledWith(false);
    });

    test("does not repeatedly broadcast stopped typing", async () => {
        const { result } = await setup();

        connectChannel();

        const connection = currentConnection();

        act(() => {
            result.current.notifyTyping("Hello");
            result.current.stopTyping();
            result.current.stopTyping();
            result.current.stopTyping();
        });

        const stoppedEvents =
            connection.broadcast.mock.calls.filter(
                ([typing]) => typing === false
            );

        expect(stoppedEvents).toHaveLength(1);
    });
});

/* -------------------- BROADCAST THROTTLING -------------------- */

describe("Broadcast throttling", () => {
    test("does not broadcast on every keystroke", async () => {
        const { result } = await setup();

        connectChannel();

        const connection = currentConnection();

        act(() => {
            result.current.notifyTyping("H");
            result.current.notifyTyping("He");
            result.current.notifyTyping("Hel");
            result.current.notifyTyping("Hell");
            result.current.notifyTyping("Hello");
        });

        const typingEvents =
            connection.broadcast.mock.calls.filter(
                ([typing]) => typing === true
            );

        expect(typingEvents).toHaveLength(1);
    });

    test("throttles broadcasts within the interval", async () => {
        const { result } = await setup();

        connectChannel();

        const connection = currentConnection();

        act(() => {
            result.current.notifyTyping("Hello");
        });

        await advanceTime(
            BROADCAST_INTERVAL - 1
        );

        act(() => {
            result.current.notifyTyping("Hello again");
        });

        expect(connection.broadcast).toHaveBeenCalledTimes(
            1
        );
    });

    test("allows another broadcast after the interval", async () => {
        const { result } = await setup();

        connectChannel();

        const connection = currentConnection();

        act(() => {
            result.current.notifyTyping("Hello");
        });

        await advanceTime(BROADCAST_INTERVAL + 1);

        act(() => {
            result.current.notifyTyping("Hello again");
        });

        const typingEvents =
            connection.broadcast.mock.calls.filter(
                ([typing]) => typing === true
            );

        expect(typingEvents).toHaveLength(2);
    });

    test("does not continuously broadcast without input", async () => {
        const { result } = await setup();

        connectChannel();

        const connection = currentConnection();

        act(() => {
            result.current.notifyTyping("Hello");
        });

        await advanceTime(10_000);

        const typingEvents =
            connection.broadcast.mock.calls.filter(
                ([typing]) => typing === true
            );

        expect(typingEvents).toHaveLength(1);
    });
});

/* -------------------- INACTIVITY TIMEOUT -------------------- */

describe("Local inactivity timeout", () => {
    test("does not stop typing prematurely", async () => {
        const { result } = await setup();

        connectChannel();

        act(() => {
            result.current.notifyTyping("Hello");
        });

        await advanceTime(
            INACTIVITY_TIMEOUT - 1
        );

        expect(
            currentConnection().broadcast
        ).not.toHaveBeenCalledWith(false);
    });

    test("stops typing after inactivity", async () => {
        const { result } = await setup();

        connectChannel();

        act(() => {
            result.current.notifyTyping("Hello");
        });

        await advanceTime(INACTIVITY_TIMEOUT);

        expect(
            currentConnection().broadcast
        ).toHaveBeenLastCalledWith(false);
    });

    test("resets the inactivity timer on new input", async () => {
        const { result } = await setup();

        connectChannel();

        act(() => {
            result.current.notifyTyping("Hello");
        });

        await advanceTime(1500);

        act(() => {
            result.current.notifyTyping("Hello again");
        });

        await advanceTime(500);

        expect(
            currentConnection().broadcast
        ).not.toHaveBeenCalledWith(false);

        await advanceTime(1500);

        expect(
            currentConnection().broadcast
        ).toHaveBeenLastCalledWith(false);
    });

    test("clears the inactivity timer when manually stopped", async () => {
        const { result } = await setup();

        connectChannel();

        const connection = currentConnection();

        act(() => {
            result.current.notifyTyping("Hello");
            result.current.stopTyping();
        });

        connection.broadcast.mockClear();

        await advanceTime(
            INACTIVITY_TIMEOUT * 2
        );

        expect(connection.broadcast).not.toHaveBeenCalled();
    });
});

/* -------------------- REMOTE TYPING -------------------- */

describe("Remote typing indicators", () => {
    test("displays a remote typing user", async () => {
        const { result } = await setup();

        connectChannel();

        receiveTyping(USER_B, true);

        expect(result.current.typingUsers).toEqual([
            USER_B,
        ]);
    });

    test("removes a user when typing stops", async () => {
        const { result } = await setup();

        connectChannel();

        receiveTyping(USER_B, true);
        receiveTyping(USER_B, false);

        expect(result.current.typingUsers).toEqual([]);
    });

    test("supports multiple remote typing users", async () => {
        const { result } = await setup();

        connectChannel();

        receiveTyping(USER_B, true);
        receiveTyping(USER_C, true);

        expect(result.current.typingUsers).toEqual(
            expect.arrayContaining([
                USER_B,
                USER_C,
            ])
        );

        expect(result.current.typingUsers).toHaveLength(2);
    });

    test("does not duplicate remote typing users", async () => {
        const { result } = await setup();

        connectChannel();

        receiveTyping(USER_B, true);
        receiveTyping(USER_B, true);
        receiveTyping(USER_B, true);

        expect(result.current.typingUsers).toEqual([
            USER_B,
        ]);
    });

    test("removes only the user who stopped typing", async () => {
        const { result } = await setup();

        connectChannel();

        receiveTyping(USER_B, true);
        receiveTyping(USER_C, true);
        receiveTyping(USER_B, false);

        expect(result.current.typingUsers).toEqual([
            USER_C,
        ]);
    });

    test("handles stopped typing from an unknown user", async () => {
        const { result } = await setup();

        connectChannel();

        receiveTyping(USER_B, false);

        expect(result.current.typingUsers).toEqual([]);
    });
});

/* -------------------- REMOTE EXPIRATION -------------------- */

describe("Remote typing expiration", () => {
    test("expires stale remote typing indicators", async () => {
        const { result } = await setup();

        connectChannel();

        receiveTyping(USER_B, true);

        await advanceTime(REMOTE_TIMEOUT);

        expect(result.current.typingUsers).toEqual([]);
    });

    test("does not expire a user prematurely", async () => {
        const { result } = await setup();

        connectChannel();

        receiveTyping(USER_B, true);

        await advanceTime(REMOTE_TIMEOUT - 1);

        expect(result.current.typingUsers).toContain(
            USER_B
        );
    });

    test("refreshes expiration when another event arrives", async () => {
        const { result } = await setup();

        connectChannel();

        receiveTyping(USER_B, true);

        await advanceTime(4000);

        receiveTyping(USER_B, true);

        await advanceTime(1000);

        expect(result.current.typingUsers).toContain(
            USER_B
        );

        await advanceTime(4000);

        expect(result.current.typingUsers).toEqual([]);
    });

    test("maintains independent expiration timers", async () => {
        const { result } = await setup();

        connectChannel();

        receiveTyping(USER_B, true);

        await advanceTime(2000);

        receiveTyping(USER_C, true);

        await advanceTime(3000);

        expect(result.current.typingUsers).toEqual([
            USER_C,
        ]);

        await advanceTime(2000);

        expect(result.current.typingUsers).toEqual([]);
    });

    test("cancels expiration when a user stops typing", async () => {
        const { result } = await setup();

        connectChannel();

        receiveTyping(USER_B, true);
        receiveTyping(USER_B, false);

        await advanceTime(REMOTE_TIMEOUT * 2);

        expect(result.current.typingUsers).toEqual([]);
    });
});

/* -------------------- CONVERSATION SWITCHING -------------------- */

describe("Conversation switching", () => {
    test("closes the previous conversation channel", async () => {
        const { rerender } = await setup();

        const previous = currentConnection();

        rerender({
            conversationId: CHAT_B,
            userId: USER_A,
            enabled: true,
        });

        await flushPromises();

        expect(previous.close).toHaveBeenCalledTimes(1);
    });

    test("connects to the new conversation", async () => {
        const { rerender } = await setup();

        rerender({
            conversationId: CHAT_B,
            userId: USER_A,
            enabled: true,
        });

        await flushPromises();

        expect(
            mockCreateTypingChannel
        ).toHaveBeenLastCalledWith(
            expect.objectContaining({
                conversationId: CHAT_B,
                userId: USER_A,
            })
        );
    });

    test("clears typing indicators when switching conversations", async () => {
        const { result, rerender } = await setup();

        connectChannel();

        receiveTyping(USER_B, true);

        rerender({
            conversationId: CHAT_B,
            userId: USER_A,
            enabled: true,
        });

        await flushPromises();

        expect(result.current.typingUsers).toEqual([]);
    });

    test("ignores late events from the previous conversation", async () => {
        const { result, rerender } = await setup();

        const previous = currentConnection();

        rerender({
            conversationId: CHAT_B,
            userId: USER_A,
            enabled: true,
        });

        await flushPromises();

        receiveTyping(
            USER_B,
            true,
            previous
        );

        expect(result.current.typingUsers).toEqual([]);
    });

    test("does not recreate channels for unchanged props", async () => {
        const { rerender } = await setup();

        rerender({
            conversationId: CHAT_A,
            userId: USER_A,
            enabled: true,
        });

        await flushPromises();

        expect(
            mockCreateTypingChannel
        ).toHaveBeenCalledTimes(1);
    });
});

/* -------------------- ACCOUNT SWITCHING -------------------- */

describe("Account switching", () => {
    test("closes the previous user's channel", async () => {
        const { rerender } = await setup();

        const previous = currentConnection();

        rerender({
            conversationId: CHAT_A,
            userId: USER_B,
            enabled: true,
        });

        await flushPromises();

        expect(previous.close).toHaveBeenCalledTimes(1);

        expect(
            mockCreateTypingChannel
        ).toHaveBeenLastCalledWith(
            expect.objectContaining({
                userId: USER_B,
            })
        );
    });

    test("clears previous account typing indicators", async () => {
        const { result, rerender } = await setup();

        connectChannel();

        receiveTyping(USER_C, true);

        rerender({
            conversationId: CHAT_A,
            userId: USER_B,
            enabled: true,
        });

        await flushPromises();

        expect(result.current.typingUsers).toEqual([]);
    });

    test("closes the channel on logout", async () => {
        const { result, rerender } = await setup();

        const connection = currentConnection();

        rerender({
            conversationId: CHAT_A,
            userId: null,
            enabled: true,
        });

        await flushPromises();

        expect(connection.close).toHaveBeenCalledTimes(1);
        expect(result.current.typingUsers).toEqual([]);
    });
});

/* -------------------- RECONNECTION -------------------- */

describe("Connection status", () => {
    test("handles disconnected status without throwing", async () => {
        await setup();

        connectChannel();

        expect(() => {
            disconnectChannel();
        }).not.toThrow();
    });

    test("resumes typing after reconnection when still active", async () => {
        const { result } = await setup();

        const connection = currentConnection();

        connectChannel();

        act(() => {
            result.current.notifyTyping("Hello");
        });

        disconnectChannel();

        connection.broadcast.mockClear();

        connectChannel();

        expect(connection.broadcast).toHaveBeenCalledWith(
            true
        );
    });

    test("does not resume typing after inactivity", async () => {
        const { result } = await setup();

        const connection = currentConnection();

        connectChannel();

        act(() => {
            result.current.notifyTyping("Hello");
        });

        disconnectChannel();

        await advanceTime(INACTIVITY_TIMEOUT);

        connection.broadcast.mockClear();

        connectChannel();

        expect(
            connection.broadcast
        ).not.toHaveBeenCalledWith(true);
    });
});

/* -------------------- ASYNCHRONOUS RACES -------------------- */

describe("Asynchronous channel creation", () => {
    test("closes a channel that resolves after unmounting", async () => {
        const request = deferred();

        mockCreateTypingChannel.mockReturnValueOnce(
            request.promise
        );

        const { unmount } = await setup();

        unmount();

        const connection = {
            broadcast: jest.fn(),
            close: jest.fn(),
        };

        await act(async () => {
            request.resolve(connection);
            await request.promise;
        });

        expect(connection.close).toHaveBeenCalledTimes(1);
    });

    test("closes a channel that resolves after disabling typing", async () => {
        const request = deferred();

        mockCreateTypingChannel.mockReturnValueOnce(
            request.promise
        );

        const { rerender } = await setup();

        rerender({
            conversationId: CHAT_A,
            userId: USER_A,
            enabled: false,
        });

        const connection = {
            broadcast: jest.fn(),
            close: jest.fn(),
        };

        await act(async () => {
            request.resolve(connection);
            await request.promise;
        });

        expect(connection.close).toHaveBeenCalledTimes(1);
    });

    test("handles failed channel creation", async () => {
        mockCreateTypingChannel.mockRejectedValueOnce(
            new Error("Connection failed")
        );

        const { result } = await setup();

        expect(result.current.typingUsers).toEqual([]);

        expect(() => {
            act(() => {
                result.current.notifyTyping("Hello");
            });
        }).not.toThrow();
    });
});

/* -------------------- CLEANUP -------------------- */

describe("Hook cleanup", () => {
    test("closes the channel on unmount", async () => {
        const { unmount } = await setup();

        const connection = currentConnection();

        unmount();

        expect(connection.close).toHaveBeenCalledTimes(1);
    });

    test("stops local typing before unmounting", async () => {
        const { result, unmount } = await setup();

        const connection = currentConnection();

        connectChannel();

        act(() => {
            result.current.notifyTyping("Hello");
        });

        unmount();

        expect(connection.broadcast).toHaveBeenCalledWith(
            false
        );
    });

test("clears pending typing timers", async () => {
  const { result, unmount } = await setup();

  connectChannel();

  const connection = currentConnection();

  const setTimeoutSpy = jest.spyOn(
    globalThis,
    "setTimeout"
  );

  const clearTimeoutSpy = jest.spyOn(
    globalThis,
    "clearTimeout"
  );

  try {
    act(() => {
      result.current.notifyTyping("Hello");
    });

    receiveTyping(USER_B, true);
    receiveTyping(USER_C, true);

    // Capture only timers associated with typing.
    const typingTimers = setTimeoutSpy.mock.calls
      .map((args, index) => ({
        delay: args[1],
        handle: setTimeoutSpy.mock.results[index].value,
      }))
      .filter(
        ({ delay }) =>
          delay === INACTIVITY_TIMEOUT ||
          delay === REMOTE_TIMEOUT
      );

    // One local timer and two remote timers.
    expect(typingTimers).toHaveLength(3);

    expect(
      typingTimers.filter(
        ({ delay }) => delay === INACTIVITY_TIMEOUT
      )
    ).toHaveLength(1);

    expect(typingTimers.filter(({ delay }) => delay === REMOTE_TIMEOUT)).toHaveLength(2);

    clearTimeoutSpy.mockClear();

    unmount();

    // Verify every typing timer was explicitly cleared.
    for (const { handle } of typingTimers) {
      expect(clearTimeoutSpy).toHaveBeenCalledWith(handle);
    }

    expect(connection.close).toHaveBeenCalledTimes(1);

    connection.broadcast.mockClear();

    await advanceTime(REMOTE_TIMEOUT * 2);

    // No delayed broadcasts after unmounting.
    expect(connection.broadcast).not.toHaveBeenCalled();

  } finally {
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  }
});

    test("ignores late callbacks after unmounting", async () => {
        const { unmount } = await setup();
        const connection = currentConnection();

        unmount();

        expect(() => {
            receiveTyping(
                USER_B,
                true,
                connection
            );

            connectChannel(connection);
        }).not.toThrow();
    });
});