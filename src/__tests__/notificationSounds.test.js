/** @jest-environment jsdom */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";

const STORAGE_KEY = "messenger:notification-sounds";

const USER_ID = "user-1";

const MESSAGE = {
  id: "message-1",
  sender_id: "user-2",
  conversation_id: "chat-1",
  mentions: [],
};

let sounds;
let store;
let cleanup;

let mockVisible;
let mockFocused;

let mockContext;
let mockOscillator;
let mockGain;
let mockAudioContext;

function createAudioMocks() {
  mockOscillator = {
    type: "sine",

    frequency: {
      setValueAtTime: jest.fn(),
    },

    connect: jest.fn(),
    disconnect: jest.fn(),

    start: jest.fn(),
    stop: jest.fn(),

    onended: null,
  };

  mockGain = {
    gain: {
      setValueAtTime: jest.fn(),
      linearRampToValueAtTime: jest.fn(),
      exponentialRampToValueAtTime: jest.fn(),
    },

    connect: jest.fn(),
    disconnect: jest.fn(),
  };

  mockContext = {
    state: "running",
    currentTime: 0,
    destination: {},

    resume: jest.fn(async () => {
      mockContext.state = "running";
    }),

    createOscillator: jest.fn(
      () => mockOscillator
    ),

    createGain: jest.fn(
      () => mockGain
    ),
  };

  mockAudioContext = jest.fn(
    () => mockContext
  );

  Object.defineProperty(
    window,
    "AudioContext",
    {
      configurable: true,
      writable: true,
      value: mockAudioContext,
    }
  );

  Object.defineProperty(
    window,
    "webkitAudioContext",
    {
      configurable: true,
      writable: true,
      value: undefined,
    }
  );
}

function incoming(overrides = {}) {
  return sounds.playIncomingMessageSound({
    message: MESSAGE,
    userId: USER_ID,
    isActiveChat: false,
    isGroup: false,
    ...overrides,
  });
}

function update(preferences) {
  store.getState().updatePreferences(
    preferences
  );
}

async function unlockAudio() {
  const result =
    await sounds.previewNotificationSound();

  expect(result).toBe(true);

  mockContext.createOscillator.mockClear();
  mockContext.createGain.mockClear();

  mockOscillator.start.mockClear();
  mockOscillator.stop.mockClear();
}

beforeEach(() => {
  jest.resetModules();

  jest.useFakeTimers();

  jest.setSystemTime(
    new Date("2026-11-28T12:00:00Z")
  );

  localStorage.clear();

  mockVisible = true;
  mockFocused = true;

  cleanup = null;

  jest
    .spyOn(document, "hasFocus")
    .mockImplementation(() => mockFocused);

  jest.doMock("@/hooks/useBrowser", () => ({
    getPageVisible: () => mockVisible,
  }));

  createAudioMocks();

  sounds = require(
    "@/lib/notificationSounds"
  );

  store = sounds.useNotificationSoundStore;
});

afterEach(() => {
  cleanup?.();

  localStorage.clear();

  jest.restoreAllMocks();

  jest.useRealTimers();

  delete window.AudioContext;
  delete window.webkitAudioContext;
});

/* -------------------- PREFERENCES -------------------- */

describe("notification sound preferences", () => {
  test("uses the expected defaults", () => {
    expect(store.getState()).toMatchObject({
      enabled: true,
      tone: "chime",
      volume: 60,
      activeConversation: false,
      mentionsOnly: false,
      hydrated: false,
    });
  });

  test("hydrates preferences", () => {
    store.getState().hydrate();

    expect(
      store.getState().hydrated
    ).toBe(true);
  });

  test("restores saved preferences", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        enabled: false,
        tone: "bell",
        volume: 35,
        activeConversation: true,
        mentionsOnly: true,
      })
    );

    store.getState().hydrate();

    expect(store.getState()).toMatchObject({
      enabled: false,
      tone: "bell",
      volume: 35,
      activeConversation: true,
      mentionsOnly: true,
      hydrated: true,
    });
  });

  test("persists preference changes", () => {
    store.getState().hydrate();

    update({
      tone: "digital",
      volume: 80,
    });

    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    expect(saved).toEqual({
      enabled: true,
      tone: "digital",
      volume: 80,
      activeConversation: false,
      mentionsOnly: false,
    });
  });

  test("handles malformed saved JSON", () => {
    localStorage.setItem(
      STORAGE_KEY,
      "{invalid"
    );

    store.getState().hydrate();

    expect(store.getState()).toMatchObject({
      hydrated: true,
      enabled: true,
      tone: "chime",
      volume: 60,
    });
  });

  test("handles null saved preferences", () => {
    localStorage.setItem(
      STORAGE_KEY,
      "null"
    );

    store.getState().hydrate();

    expect(store.getState()).toMatchObject({
      hydrated: true,
      enabled: true,
      tone: "chime",
      volume: 60,
    });
  });

  test.each([
    [-20, 0],
    [150, 100],
    [42.7, 43],
    [NaN, 60],
    [Infinity, 60],
    ["50", 60],
    [null, 60],
  ])(
    "sanitizes volume %p to %p",
    (input, expected) => {
      update({ volume: input });

      expect(
        store.getState().volume
      ).toBe(expected);
    }
  );

  test.each([
    "invalid",
    "__proto__",
    "constructor",
    null,
    undefined,
  ])("rejects invalid tone %p", (tone) => {
    update({ tone });

    expect(
      store.getState().tone
    ).toBe("chime");
  });

  test("sanitizes invalid boolean values", () => {
    update({
      enabled: "false",
      activeConversation: "true",
      mentionsOnly: 1,
    });

    expect(store.getState()).toMatchObject({
      enabled: true,
      activeConversation: false,
      mentionsOnly: false,
    });
  });

  test("does not notify subscribers for unchanged preferences", () => {
    const listener = jest.fn();

    const unsubscribe =
      store.subscribe(listener);

    update({
      enabled: true,
      volume: 60,
      tone: "chime",
    });

    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  test("resets preferences to defaults", () => {
    update({
      enabled: false,
      tone: "double",
      volume: 10,
      activeConversation: true,
      mentionsOnly: true,
    });

    store.getState().resetPreferences();

    expect(store.getState()).toMatchObject({
      enabled: true,
      tone: "chime",
      volume: 60,
      activeConversation: false,
      mentionsOnly: false,
    });
  });

  test("does not hydrate twice", () => {
    store.getState().hydrate();

    update({ volume: 75 });

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: 20 })
    );

    store.getState().hydrate();

    expect(
      store.getState().volume
    ).toBe(75);
  });

  test("remains functional when storage writes fail", () => {
    jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("Storage unavailable");
      });

    expect(() =>
      update({ volume: 45 })
    ).not.toThrow();

    expect(
      store.getState().volume
    ).toBe(45);
  });

  test("remains functional when storage reads fail", () => {
    jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("Storage unavailable");
      });

    expect(() =>
      store.getState().hydrate()
    ).not.toThrow();

    expect(store.getState()).toMatchObject({
      hydrated: true,
      volume: 60,
    });
  });
});

/* -------------------- INITIALISATION -------------------- */

describe("notification sound initialisation", () => {
  test("hydrates preferences without creating audio context", () => {
    cleanup =
      sounds.initializeNotificationSounds();

    expect(
      store.getState().hydrated
    ).toBe(true);

    expect(
      mockAudioContext
    ).not.toHaveBeenCalled();
  });

  test("registers browser event listeners", () => {
    const addListener = jest.spyOn(
      window,
      "addEventListener"
    );

    cleanup =
      sounds.initializeNotificationSounds();

    expect(addListener).toHaveBeenCalledWith(
      "pointerdown",
      expect.any(Function),
      { passive: true }
    );

    expect(addListener).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function)
    );

    expect(addListener).toHaveBeenCalledWith(
      "storage",
      expect.any(Function)
    );
  });

  test("removes browser listeners during cleanup", () => {
    const removeListener = jest.spyOn(
      window,
      "removeEventListener"
    );

    const dispose =
      sounds.initializeNotificationSounds();

    dispose();

    expect(
      removeListener
    ).toHaveBeenCalledWith(
      "pointerdown",
      expect.any(Function)
    );

    expect(
      removeListener
    ).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function)
    );

    expect(
      removeListener
    ).toHaveBeenCalledWith(
      "storage",
      expect.any(Function)
    );
  });

  test("synchronizes preferences across tabs", () => {
    cleanup =
      sounds.initializeNotificationSounds();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        volume: 25,
        tone: "bell",
      })
    );

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEY,
      })
    );

    expect(store.getState()).toMatchObject({
      volume: 25,
      tone: "bell",
    });
  });

  test("ignores unrelated storage changes", () => {
    cleanup =
      sounds.initializeNotificationSounds();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ volume: 20 })
    );

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "unrelated-key",
      })
    );

    expect(
      store.getState().volume
    ).toBe(60);
  });

  test("does not unlock audio for synthetic interactions", () => {
    cleanup =
      sounds.initializeNotificationSounds();

    window.dispatchEvent(
      new Event("pointerdown")
    );

    expect(
      mockAudioContext
    ).not.toHaveBeenCalled();
  });
});

/* -------------------- AUDIO PREVIEW -------------------- */

describe("notification sound preview", () => {
  beforeEach(() => {
    store.getState().hydrate();
  });

  test.each([
    ["chime", 2],
    ["pop", 2],
    ["digital", 3],
    ["bell", 2],
    ["double", 2],
  ])(
    "plays %s using %i oscillators",
    async (tone, count) => {
      update({ tone });

      const result =
        await sounds.previewNotificationSound();

      expect(result).toBe(true);

      expect(
        mockContext.createOscillator
      ).toHaveBeenCalledTimes(count);

      expect(
        mockOscillator.start
      ).toHaveBeenCalledTimes(count);

      expect(
        mockOscillator.stop
      ).toHaveBeenCalledTimes(count);
    }
  );

  test("reuses a single audio context", async () => {
    await sounds.previewNotificationSound();
    await sounds.previewNotificationSound();
    await sounds.previewNotificationSound();

    expect(
      mockAudioContext
    ).toHaveBeenCalledTimes(1);
  });

  test("resumes a suspended audio context", async () => {
    mockContext.state = "suspended";

    expect(
      await sounds.previewNotificationSound()
    ).toBe(true);

    expect(
      mockContext.resume
    ).toHaveBeenCalledTimes(1);
  });

  test("handles rejected audio permissions", async () => {
    mockContext.state = "suspended";

    mockContext.resume.mockRejectedValue(
      new Error("Playback blocked")
    );

    expect(
      await sounds.previewNotificationSound()
    ).toBe(false);
  });

  test("handles unsupported browsers", async () => {
    window.AudioContext = undefined;

    expect(
      await sounds.previewNotificationSound()
    ).toBe(false);
  });

  test("does not play at zero volume", async () => {
    update({ volume: 0 });

    expect(
      await sounds.previewNotificationSound()
    ).toBe(false);

    expect(
      mockContext.createOscillator
    ).not.toHaveBeenCalled();
  });

  test("handles audio node creation failures", async () => {
    mockContext.createOscillator.mockImplementation(
      () => {
        throw new Error("Audio failure");
      }
    );

    expect(
      await sounds.previewNotificationSound()
    ).toBe(false);
  });

  test("disconnects audio nodes after playback", async () => {
    await sounds.previewNotificationSound();

    mockOscillator.onended();

    expect(
      mockOscillator.disconnect
    ).toHaveBeenCalled();

    expect(
      mockGain.disconnect
    ).toHaveBeenCalled();
  });
});

/* -------------------- INCOMING MESSAGES -------------------- */

describe("incoming message sounds", () => {
  beforeEach(async () => {
    store.getState().hydrate();

    await unlockAudio();
  });

  test("plays sounds for incoming private messages", () => {
    expect(incoming()).toBe(true);

    expect(
      mockOscillator.start
    ).toHaveBeenCalled();
  });

  test("ignores messages sent by the current user", () => {
    expect(
      incoming({
        message: {
          ...MESSAGE,
          sender_id: USER_ID,
        },
      })
    ).toBe(false);

    expect(
      mockOscillator.start
    ).not.toHaveBeenCalled();
  });

  test.each([
    null,
    undefined,
    {},
    { id: "message-1" },
    { sender_id: "user-2" },
  ])("ignores invalid message %p", (message) => {
    expect(
      incoming({ message })
    ).toBe(false);
  });

  test("ignores messages without a current user", () => {
    expect(
      incoming({ userId: null })
    ).toBe(false);
  });

  test("respects disabled sounds", () => {
    update({ enabled: false });

    expect(incoming()).toBe(false);
  });

  test("respects muted volume", () => {
    update({ volume: 0 });

    expect(incoming()).toBe(false);
  });

  test("does not play before preferences hydrate", () => {
    store.setState({ hydrated: false });

    expect(incoming()).toBe(false);
  });

  test("does not play in hidden tabs", () => {
    mockVisible = false;

    expect(incoming()).toBe(false);
  });

  test("does not play in unfocused windows", () => {
    mockFocused = false;

    expect(incoming()).toBe(false);
  });

  test("does not play in the active conversation by default", () => {
    expect(
      incoming({ isActiveChat: true })
    ).toBe(false);
  });

  test("supports sounds in the active conversation", () => {
    update({
      activeConversation: true,
    });

    expect(
      incoming({ isActiveChat: true })
    ).toBe(true);
  });

  test("plays ordinary group messages by default", () => {
    expect(
      incoming({ isGroup: true })
    ).toBe(true);
  });

  test("ignores unmentioned group messages in mentions-only mode", () => {
    update({ mentionsOnly: true });

    expect(
      incoming({ isGroup: true })
    ).toBe(false);
  });

  test("plays group mentions addressed to the current user", () => {
    update({ mentionsOnly: true });

    expect(
      incoming({
        isGroup: true,
        message: {
          ...MESSAGE,
          mentions: [
            {
              user_id: USER_ID,
              username: "testuser",
            },
          ],
        },
      })
    ).toBe(true);
  });

  test("ignores mentions addressed to other users", () => {
    update({ mentionsOnly: true });

    expect(
      incoming({
        isGroup: true,
        message: {
          ...MESSAGE,
          mentions: [
            { user_id: "another-user" },
          ],
        },
      })
    ).toBe(false);
  });

  test.each([
    null,
    undefined,
    {},
    "invalid",
    [null],
  ])(
    "handles malformed mentions %p",
    (mentions) => {
      update({ mentionsOnly: true });

      expect(
        incoming({
          isGroup: true,
          message: {
            ...MESSAGE,
            mentions,
          },
        })
      ).toBe(false);
    }
  );

  test("mentions-only mode does not suppress private messages", () => {
    update({ mentionsOnly: true });

    expect(incoming()).toBe(true);
  });

  test("does not play when audio becomes suspended", () => {
    mockContext.state = "suspended";

    expect(incoming()).toBe(false);
  });

  test("does not interrupt messaging when audio fails", () => {
    mockContext.createOscillator.mockImplementation(
      () => {
        throw new Error("Audio failure");
      }
    );

    expect(incoming()).toBe(false);
  });
});

/* -------------------- RATE LIMITING -------------------- */

describe("notification sound rate limiting", () => {
  beforeEach(async () => {
    store.getState().hydrate();

    await unlockAudio();
  });

  test("suppresses rapid consecutive sounds", () => {
    expect(incoming()).toBe(true);

    expect(incoming()).toBe(false);
    expect(incoming()).toBe(false);
  });

  test("suppresses sounds within 499 milliseconds", () => {
    expect(incoming()).toBe(true);

    jest.advanceTimersByTime(499);

    expect(incoming()).toBe(false);
  });

  test("allows sounds after 500 milliseconds", () => {
    expect(incoming()).toBe(true);

    jest.advanceTimersByTime(500);

    expect(incoming()).toBe(true);
  });

  test("filtered messages do not consume the rate limit", () => {
    expect(
      incoming({
        message: {
          ...MESSAGE,
          sender_id: USER_ID,
        },
      })
    ).toBe(false);

    expect(incoming()).toBe(true);
  });

  test("failed playback does not consume the rate limit", () => {
    mockContext.state = "suspended";

    expect(incoming()).toBe(false);

    mockContext.state = "running";

    expect(incoming()).toBe(true);
  });
});

/* -------------------- LOCKED AUDIO -------------------- */

describe("audio before user interaction", () => {
  test("does not create audio context for incoming messages", () => {
    store.getState().hydrate();

    expect(incoming()).toBe(false);

    expect(
      mockAudioContext
    ).not.toHaveBeenCalled();
  });
});