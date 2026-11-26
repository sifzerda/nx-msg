// src/__tests__/logout.test.js
/** @jest-environment jsdom */

import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

/* -------------------- AUTH MOCKS -------------------- */

const mockSignOut = jest.fn();

const mockCreateClient = jest.fn(() => ({
  auth: {
    signOut: mockSignOut,
  },
}));

/* -------------------- STORE MOCKS -------------------- */

const mockResetPush = jest.fn();
const mockResetBlock = jest.fn();
const mockResetChat = jest.fn();
const mockResetContacts = jest.fn();
const mockResetPresence = jest.fn();

const mockPrepareForLogout = jest.fn();
const mockCancelLogout = jest.fn();
const mockRefreshPush = jest.fn();

const mockPushState = {
  reset: mockResetPush,
  prepareForLogout: mockPrepareForLogout,
  cancelLogout: mockCancelLogout,
  refresh: mockRefreshPush,
};

/* -------------------- CACHE MOCKS -------------------- */

const mockClearProfiles = jest.fn();
const mockClearAttachments = jest.fn();
const mockClearLinkPreviews = jest.fn();

/* -------------------- BROWSER MOCKS -------------------- */

const mockFetch = jest.fn();
const mockGetRegistration = jest.fn();
const mockGetSubscription = jest.fn();
const mockUnsubscribe = jest.fn();

const ENDPOINT = "https://push.example.com/subscription";

const mockSubscription = {
  endpoint: ENDPOINT,
  unsubscribe: mockUnsubscribe,
};

const mockRegistration = {
  pushManager: {
    getSubscription: mockGetSubscription,
  },
};

/* -------------------- REGISTER MOCKS -------------------- */

jest.doMock("@/lib/supabase/client", () => ({
  createClient: mockCreateClient,
}));

jest.doMock("@/lib/messageProfiles", () => ({
  clearMessageProfileCache: mockClearProfiles,
}));

jest.doMock("@/lib/extras/attachments", () => ({
  clearAttachmentCache: mockClearAttachments,
}));

jest.doMock("@/lib/linkPreviews", () => ({
  clearLinkPreviewCache: mockClearLinkPreviews,
}));

jest.doMock("@/store/usePushStore", () => ({
  __esModule: true,
  default: {
    getState: () => mockPushState,
  },
}));

jest.doMock("@/store/useBlockStore", () => ({
  __esModule: true,
  default: {
    getState: () => ({
      reset: mockResetBlock,
    }),
  },
}));

jest.doMock("@/store/useChatStore", () => ({
  __esModule: true,
  default: {
    getState: () => ({
      reset: mockResetChat,
    }),
  },
}));

jest.doMock("@/store/useContactStore", () => ({
  __esModule: true,
  default: {
    getState: () => ({
      reset: mockResetContacts,
    }),
  },
}));

jest.doMock("@/store/usePresenceStore", () => ({
  __esModule: true,
  default: {
    getState: () => ({
      reset: mockResetPresence,
    }),
  },
}));

/* -------------------- LOAD SERVICE -------------------- */

const { logout } = require("@/lib/logout");

/* -------------------- HELPERS -------------------- */

const storeResets = [
  mockResetPush,
  mockResetBlock,
  mockResetChat,
  mockResetContacts,
  mockResetPresence,
];

const cacheResets = [
  mockClearProfiles,
  mockClearAttachments,
  mockClearLinkPreviews,
];

function expectStoresReset(times = 1) {
  for (const reset of storeResets) {
    expect(reset).toHaveBeenCalledTimes(times);
  }
}

function expectCachesCleared(times = 1) {
  for (const clear of cacheResets) {
    expect(clear).toHaveBeenCalledTimes(times);
  }
}

function expectNoApplicationCleanup() {
  expectStoresReset(0);
  expectCachesCleared(0);
}

function expectCalledBefore(first, second) {
  expect(first).toHaveBeenCalled();
  expect(second).toHaveBeenCalled();

  expect(
    first.mock.invocationCallOrder[0]
  ).toBeLessThan(
    second.mock.invocationCallOrder[0]
  );
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

function enablePushSubscription() {
  mockGetRegistration.mockResolvedValue(
    mockRegistration
  );

  mockGetSubscription.mockResolvedValue(
    mockSubscription
  );
}

function mockServerFailure(
  status = 500,
  message = "Unsubscribe failed"
) {
  mockFetch.mockResolvedValue({
    ok: false,
    status,

    json: jest.fn().mockResolvedValue({
      error: message,
    }),
  });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

/* -------------------- TEST SETUP -------------------- */

let errorSpy;
let originalFetch;
let originalServiceWorker;

beforeEach(() => {
  jest.resetAllMocks();

  originalFetch = Object.getOwnPropertyDescriptor(
    globalThis,
    "fetch"
  );

  originalServiceWorker =
    Object.getOwnPropertyDescriptor(
      navigator,
      "serviceWorker"
    );

  mockSignOut.mockResolvedValue({
    error: null,
  });

  mockPrepareForLogout.mockResolvedValue(
    undefined
  );

  mockRefreshPush.mockResolvedValue(true);

  mockGetRegistration.mockResolvedValue(null);

  mockGetSubscription.mockResolvedValue(null);

  mockUnsubscribe.mockResolvedValue(true);

  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,

    json: jest.fn().mockResolvedValue({
      success: true,
    }),
  });

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: mockFetch,
  });

  Object.defineProperty(
    navigator,
    "serviceWorker",
    {
      configurable: true,

      value: {
        getRegistration: mockGetRegistration,
      },
    }
  );

  errorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();

  if (originalFetch) {
    Object.defineProperty(
      globalThis,
      "fetch",
      originalFetch
    );
  } else {
    delete globalThis.fetch;
  }

  if (originalServiceWorker) {
    Object.defineProperty(
      navigator,
      "serviceWorker",
      originalServiceWorker
    );
  } else {
    delete navigator.serviceWorker;
  }
});

/* -------------------- SUCCESSFUL LOGOUT -------------------- */

describe("Logout - successful operation", () => {
  test("returns a successful logout result", async () => {
    await expect(logout()).resolves.toEqual({
      success: true,
      pushCleanupError: null,
    });
  });

  test("signs out exactly once", async () => {
    await logout();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  test("prepares push notifications for logout", async () => {
    await logout();

    expect(
      mockPrepareForLogout
    ).toHaveBeenCalledTimes(1);
  });

  test("prepares push notifications before signing out", async () => {
    await logout();

    expectCalledBefore(
      mockPrepareForLogout,
      mockSignOut
    );
  });

  test("does not cancel logout after success", async () => {
    await logout();

    expect(
      mockCancelLogout
    ).not.toHaveBeenCalled();
  });

  test("does not restore notifications after success", async () => {
    await logout();

    expect(
      mockRefreshPush
    ).not.toHaveBeenCalled();
  });

  test("does not log errors during normal logout", async () => {
    await logout();

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

/* -------------------- STORE CLEANUP -------------------- */

describe("Logout - store cleanup", () => {
  test("resets the push store", async () => {
    await logout();

    expect(mockResetPush).toHaveBeenCalledTimes(1);
  });

  test("resets the block store", async () => {
    await logout();

    expect(mockResetBlock).toHaveBeenCalledTimes(1);
  });

  test("resets the chat store", async () => {
    await logout();

    expect(mockResetChat).toHaveBeenCalledTimes(1);
  });

  test("resets the contacts store", async () => {
    await logout();

    expect(
      mockResetContacts
    ).toHaveBeenCalledTimes(1);
  });

  test("resets the presence store", async () => {
    await logout();

    expect(
      mockResetPresence
    ).toHaveBeenCalledTimes(1);
  });

  test("resets every store exactly once", async () => {
    await logout();

    expectStoresReset();
  });

  test("resets stores only after successful sign-out", async () => {
    await logout();

    for (const reset of storeResets) {
      expectCalledBefore(
        mockSignOut,
        reset
      );
    }
  });
});

/* -------------------- CACHE CLEANUP -------------------- */

describe("Logout - cache cleanup", () => {
  test("clears the message profile cache", async () => {
    await logout();

    expect(
      mockClearProfiles
    ).toHaveBeenCalledTimes(1);
  });

  test("clears the attachment cache", async () => {
    await logout();

    expect(
      mockClearAttachments
    ).toHaveBeenCalledTimes(1);
  });

  test("clears the link preview cache", async () => {
    await logout();

    expect(
      mockClearLinkPreviews
    ).toHaveBeenCalledTimes(1);
  });

  test("clears every cache exactly once", async () => {
    await logout();

    expectCachesCleared();
  });

  test("clears caches after resetting stores", async () => {
    await logout();

    for (const reset of storeResets) {
      for (const clear of cacheResets) {
        expectCalledBefore(reset, clear);
      }
    }
  });
});

/* -------------------- NO PUSH SUBSCRIPTION -------------------- */

describe("Logout - without push subscription", () => {
  test("looks up the root service worker registration", async () => {
    await logout();

    expect(
      mockGetRegistration
    ).toHaveBeenCalledWith("/");
  });

  test("handles a missing service worker registration", async () => {
    mockGetRegistration.mockResolvedValue(null);

    await expect(logout()).resolves.toEqual({
      success: true,
      pushCleanupError: null,
    });
  });

  test("handles a missing push manager", async () => {
    mockGetRegistration.mockResolvedValue({});

    await expect(logout()).resolves.toEqual({
      success: true,
      pushCleanupError: null,
    });
  });

  test("handles a missing push subscription", async () => {
    mockGetRegistration.mockResolvedValue(
      mockRegistration
    );

    mockGetSubscription.mockResolvedValue(null);

    await expect(logout()).resolves.toEqual({
      success: true,
      pushCleanupError: null,
    });
  });

  test("does not send an unsubscribe request without a subscription", async () => {
    await logout();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("does not attempt browser unsubscribe without a subscription", async () => {
    await logout();

    expect(
      mockUnsubscribe
    ).not.toHaveBeenCalled();
  });

  test("still resets all stores without a subscription", async () => {
    await logout();

    expectStoresReset();
    expectCachesCleared();
  });
});

/* -------------------- PUSH CLEANUP SUCCESS -------------------- */

describe("Logout - push cleanup success", () => {
  beforeEach(() => {
    enablePushSubscription();
  });

  test("retrieves the current push subscription", async () => {
    await logout();

    expect(
      mockGetSubscription
    ).toHaveBeenCalledTimes(1);
  });

  test("calls the unsubscribe API", async () => {
    await logout();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/push/unsubscribe",
      expect.any(Object)
    );
  });

  test("uses a POST request", async () => {
    await logout();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  test("uses JSON request headers", async () => {
    await logout();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
        },
      })
    );
  });

  test("disables caching for unsubscribe requests", async () => {
    await logout();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        cache: "no-store",
      })
    );
  });

  test("sends the current subscription endpoint", async () => {
    await logout();

    const options =
      mockFetch.mock.calls[0][1];

    expect(
      JSON.parse(options.body)
    ).toEqual({
      endpoint: ENDPOINT,
      rememberPreference: false,
    });
  });

  test("preserves the saved notification preference", async () => {
    await logout();

    const options =
      mockFetch.mock.calls[0][1];

    expect(
      JSON.parse(options.body)
        .rememberPreference
    ).toBe(false);
  });

  test("removes the browser subscription", async () => {
    await logout();

    expect(
      mockUnsubscribe
    ).toHaveBeenCalledTimes(1);
  });

  test("performs server cleanup before browser cleanup", async () => {
    await logout();

    expectCalledBefore(
      mockFetch,
      mockUnsubscribe
    );
  });

  test("performs browser cleanup before signing out", async () => {
    await logout();

    expectCalledBefore(
      mockUnsubscribe,
      mockSignOut
    );
  });

  test("uses only one unsubscribe API request", async () => {
    await logout();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("returns no push cleanup error after success", async () => {
    const result = await logout();

    expect(result.pushCleanupError).toBeNull();
  });
});

/* -------------------- SERVER CLEANUP FAILURES -------------------- */

describe("Logout - server cleanup failures", () => {
  beforeEach(() => {
    enablePushSubscription();
  });

  test("continues logout when the unsubscribe API fails", async () => {
    mockServerFailure();

    const result = await logout();

    expect(result.success).toBe(true);

    expect(
      mockSignOut
    ).toHaveBeenCalledTimes(1);
  });

  test("returns the server cleanup error", async () => {
    mockServerFailure(
      500,
      "Database unavailable"
    );

    const result = await logout();

    expect(
      result.pushCleanupError
    ).toMatchObject({
      message: "Database unavailable",
    });
  });

  test("still removes the browser subscription", async () => {
    mockServerFailure();

    await logout();

    expect(
      mockUnsubscribe
    ).toHaveBeenCalledTimes(1);
  });

  test("still resets all stores and caches", async () => {
    mockServerFailure();

    await logout();

    expectStoresReset();
    expectCachesCleared();
  });

  test("handles network failures", async () => {
    const error = new Error("Network unavailable");

    mockFetch.mockRejectedValue(error);

    const result = await logout();

    expect(result.success).toBe(true);

    expect(result.pushCleanupError).toBe(error);
  });

  test("handles invalid JSON error responses", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,

      json: jest.fn().mockRejectedValue(
        new Error("Invalid JSON")
      ),
    });

    const result = await logout();

    expect(
      result.pushCleanupError
    ).toMatchObject({
      message: "Push unsubscribe failed (502)",
    });
  });

  test("handles error responses without an error message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,

      json: jest.fn().mockResolvedValue({}),
    });

    const result = await logout();

    expect(
      result.pushCleanupError
    ).toMatchObject({
      message: "Push unsubscribe failed (503)",
    });
  });

  test("does not retry failed server cleanup", async () => {
    mockServerFailure();

    await logout();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("logs the server cleanup failure", async () => {
    mockServerFailure();

    await logout();

    expect(errorSpy).toHaveBeenCalledWith(
      "Server push cleanup failed:",
      expect.any(Error)
    );
  });
});

/* -------------------- BROWSER CLEANUP FAILURES -------------------- */

describe("Logout - browser cleanup failures", () => {
  beforeEach(() => {
    enablePushSubscription();
  });

  test("continues logout when browser unsubscribe returns false", async () => {
    mockUnsubscribe.mockResolvedValue(false);

    const result = await logout();

    expect(result.success).toBe(true);

    expect(
      result.pushCleanupError
    ).toMatchObject({
      message:
        "Browser subscription could not be removed",
    });
  });

  test("handles browser unsubscribe rejection", async () => {
    const error = new Error(
      "Browser unsubscribe failed"
    );

    mockUnsubscribe.mockRejectedValue(error);

    const result = await logout();

    expect(result.success).toBe(true);
    expect(result.pushCleanupError).toBe(error);
  });

  test("still resets stores after browser cleanup failure", async () => {
    mockUnsubscribe.mockResolvedValue(false);

    await logout();

    expectStoresReset();
    expectCachesCleared();
  });

  test("logs browser cleanup failures", async () => {
    mockUnsubscribe.mockResolvedValue(false);

    await logout();

    expect(errorSpy).toHaveBeenCalledWith(
      "Browser push cleanup failed:",
      expect.any(Error)
    );
  });

  test("preserves the first error when both cleanup operations fail", async () => {
    const serverError = new Error(
      "Server failure"
    );

    const browserError = new Error(
      "Browser failure"
    );

    mockFetch.mockRejectedValue(serverError);

    mockUnsubscribe.mockRejectedValue(
      browserError
    );

    const result = await logout();

    expect(
      result.pushCleanupError
    ).toBe(serverError);

    expect(result.success).toBe(true);
  });

  test("handles service worker lookup failure", async () => {
    const error = new Error(
      "Service worker unavailable"
    );

    mockGetRegistration.mockRejectedValue(error);

    const result = await logout();

    expect(result.success).toBe(true);
    expect(result.pushCleanupError).toBe(error);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("handles push subscription lookup failure", async () => {
    const error = new Error(
      "Subscription lookup failed"
    );

    mockGetSubscription.mockRejectedValue(error);

    const result = await logout();

    expect(result.success).toBe(true);
    expect(result.pushCleanupError).toBe(error);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

/* -------------------- PUSH PREPARATION FAILURES -------------------- */

describe("Logout - push preparation failures", () => {
  test("continues logout when push preparation fails", async () => {
    mockPrepareForLogout.mockRejectedValue(
      new Error("Preparation failed")
    );

    const result = await logout();

    expect(result.success).toBe(true);

    expect(
      mockSignOut
    ).toHaveBeenCalledTimes(1);
  });

  test("returns the preparation error", async () => {
    const error = new Error(
      "Preparation failed"
    );

    mockPrepareForLogout.mockRejectedValue(error);

    const result = await logout();

    expect(result.pushCleanupError).toBe(error);
  });

  test("still attempts subscription cleanup", async () => {
    enablePushSubscription();

    mockPrepareForLogout.mockRejectedValue(
      new Error("Preparation failed")
    );

    await logout();

    expect(mockFetch).toHaveBeenCalledTimes(1);

    expect(
      mockUnsubscribe
    ).toHaveBeenCalledTimes(1);
  });

  test("preserves preparation errors over later cleanup errors", async () => {
    enablePushSubscription();

    const preparationError = new Error(
      "Preparation failed"
    );

    mockPrepareForLogout.mockRejectedValue(
      preparationError
    );

    mockFetch.mockRejectedValue(
      new Error("Server cleanup failed")
    );

    const result = await logout();

    expect(
      result.pushCleanupError
    ).toBe(preparationError);
  });

  test("logs preparation failures", async () => {
    const error = new Error(
      "Preparation failed"
    );

    mockPrepareForLogout.mockRejectedValue(error);

    await logout();

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to prepare notifications for logout:",
      error
    );
  });
});

/* -------------------- SIGN-OUT FAILURES -------------------- */

describe("Logout - sign-out failures", () => {
  test("propagates a Supabase sign-out error", async () => {
    const error = new Error("Signout failed");

    mockSignOut.mockResolvedValue({
      error,
    });

    await expect(logout()).rejects.toBe(error);
  });

  test("propagates a rejected sign-out request", async () => {
    const error = new Error(
      "Authentication network error"
    );

    mockSignOut.mockRejectedValue(error);

    await expect(logout()).rejects.toBe(error);
  });

  test("does not reset application stores after sign-out failure", async () => {
    mockSignOut.mockResolvedValue({
      error: new Error("Signout failed"),
    });

    await expect(logout()).rejects.toThrow();

    expectNoApplicationCleanup();
  });

  test("cancels the push logout lock", async () => {
    mockSignOut.mockResolvedValue({
      error: new Error("Signout failed"),
    });

    await expect(logout()).rejects.toThrow();

    expect(
      mockCancelLogout
    ).toHaveBeenCalledTimes(1);
  });

  test("refreshes notifications after failed sign-out", async () => {
    mockSignOut.mockResolvedValue({
      error: new Error("Signout failed"),
    });

    await expect(logout()).rejects.toThrow();

    expect(
      mockRefreshPush
    ).toHaveBeenCalledTimes(1);
  });

  test("cancels the logout lock before refreshing notifications", async () => {
    mockSignOut.mockResolvedValue({
      error: new Error("Signout failed"),
    });

    await expect(logout()).rejects.toThrow();

    expectCalledBefore(
      mockCancelLogout,
      mockRefreshPush
    );
  });

  test("restores notification state after subscription cleanup and failed sign-out", async () => {
    enablePushSubscription();

    mockSignOut.mockResolvedValue({
      error: new Error("Signout failed"),
    });

    await expect(logout()).rejects.toThrow();

    expect(mockFetch).toHaveBeenCalledTimes(1);

    expect(
      mockUnsubscribe
    ).toHaveBeenCalledTimes(1);

    expect(
      mockRefreshPush
    ).toHaveBeenCalledTimes(1);

    expectNoApplicationCleanup();
  });

  test("preserves the sign-out error when notification restoration fails", async () => {
    const signOutError = new Error(
      "Signout failed"
    );

    const restoreError = new Error(
      "Notification restoration failed"
    );

    mockSignOut.mockResolvedValue({
      error: signOutError,
    });

    mockRefreshPush.mockRejectedValue(
      restoreError
    );

    await expect(logout()).rejects.toBe(
      signOutError
    );

    await flushPromises();

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to restore notifications:",
      restoreError
    );
  });

  test("allows retrying after a failed sign-out", async () => {
    mockSignOut
      .mockResolvedValueOnce({
        error: new Error("Signout failed"),
      })
      .mockResolvedValueOnce({
        error: null,
      });

    await expect(logout()).rejects.toThrow();

    await expect(logout()).resolves.toEqual({
      success: true,
      pushCleanupError: null,
    });

    expect(mockSignOut).toHaveBeenCalledTimes(2);

    expectStoresReset();
    expectCachesCleared();
  });
});

/* -------------------- ASYNCHRONOUS ORDERING -------------------- */

describe("Logout - asynchronous ordering", () => {
  test("waits for push preparation before subscription cleanup", async () => {
    const request = deferred();

    mockPrepareForLogout.mockReturnValue(
      request.promise
    );

    const operation = logout();

    try {
      await flushPromises();

      expect(
        mockPrepareForLogout
      ).toHaveBeenCalledTimes(1);

      expect(
        mockGetRegistration
      ).not.toHaveBeenCalled();

      expect(
        mockSignOut
      ).not.toHaveBeenCalled();
    } finally {
      request.resolve();
      await operation;
    }
  });

  test("waits for server cleanup before browser unsubscribe", async () => {
    enablePushSubscription();

    const request = deferred();
    const started = deferred();

    mockFetch.mockImplementation(() => {
      started.resolve();
      return request.promise;
    });

    const operation = logout();

    try {
      await started.promise;

      expect(
        mockUnsubscribe
      ).not.toHaveBeenCalled();

      expect(
        mockSignOut
      ).not.toHaveBeenCalled();
    } finally {
      request.resolve({
        ok: true,
        status: 200,
      });

      await operation;
    }
  });

  test("waits for browser unsubscribe before sign-out", async () => {
    enablePushSubscription();

    const request = deferred();
    const started = deferred();

    mockUnsubscribe.mockImplementation(() => {
      started.resolve();
      return request.promise;
    });

    const operation = logout();

    try {
      await started.promise;

      expect(
        mockSignOut
      ).not.toHaveBeenCalled();

      expectNoApplicationCleanup();
    } finally {
      request.resolve(true);
      await operation;
    }
  });

  test("does not reset application state while sign-out is pending", async () => {
    const request = deferred();
    const started = deferred();

    mockSignOut.mockImplementation(() => {
      started.resolve();
      return request.promise;
    });

    const operation = logout();

    try {
      await started.promise;

      expectNoApplicationCleanup();
    } finally {
      request.resolve({
        error: null,
      });

      await operation;
    }

    expectStoresReset();
    expectCachesCleared();
  });
});

/* -------------------- CONCURRENT LOGOUT -------------------- */

describe("Logout - concurrent request deduplication", () => {
  test("returns the same promise for concurrent callers", async () => {
    const first = logout();
    const second = logout();
    const third = logout();

    try {
      expect(first).toBe(second);
      expect(second).toBe(third);
    } finally {
      await Promise.all([
        first,
        second,
        third,
      ]);
    }
  });

  test("performs only one sign-out for concurrent callers", async () => {
    await Promise.all([
      logout(),
      logout(),
      logout(),
      logout(),
    ]);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  test("performs only one push preparation operation", async () => {
    await Promise.all([
      logout(),
      logout(),
      logout(),
    ]);

    expect(
      mockPrepareForLogout
    ).toHaveBeenCalledTimes(1);
  });

  test("performs only one push cleanup operation", async () => {
    enablePushSubscription();

    await Promise.all([
      logout(),
      logout(),
      logout(),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    expect(
      mockUnsubscribe
    ).toHaveBeenCalledTimes(1);
  });

  test("resets application state only once", async () => {
    await Promise.all([
      logout(),
      logout(),
      logout(),
    ]);

    expectStoresReset();
    expectCachesCleared();
  });

  test("shares successful results with every caller", async () => {
    const results = await Promise.all([
      logout(),
      logout(),
      logout(),
    ]);

    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);

    expect(results[0]).toEqual({
      success: true,
      pushCleanupError: null,
    });
  });

  test("shares failures with every caller", async () => {
    const error = new Error(
      "Signout failed"
    );

    mockSignOut.mockResolvedValue({
      error,
    });

    const results = await Promise.allSettled([
      logout(),
      logout(),
      logout(),
    ]);

    for (const result of results) {
      expect(result.status).toBe("rejected");
      expect(result.reason).toBe(error);
    }

    expect(mockSignOut).toHaveBeenCalledTimes(1);

    expect(
      mockCancelLogout
    ).toHaveBeenCalledTimes(1);

    expectNoApplicationCleanup();
  });

  test("clears the active request after successful logout", async () => {
    const first = logout();

    await first;

    const second = logout();

    try {
      expect(second).not.toBe(first);
    } finally {
      await second;
    }

    expect(mockSignOut).toHaveBeenCalledTimes(2);
  });

  test("clears the active request after failed logout", async () => {
    mockSignOut.mockResolvedValueOnce({
      error: new Error("Signout failed"),
    });

    const first = logout();

    await expect(first).rejects.toThrow();

    const second = logout();

    try {
      expect(second).not.toBe(first);
    } finally {
      await second;
    }

    expect(mockSignOut).toHaveBeenCalledTimes(2);
  });
});

/* -------------------- REQUEST EFFICIENCY -------------------- */

describe("Logout - request efficiency", () => {
  test("uses no unsubscribe API requests without a subscription", async () => {
    await logout();

    expect(mockFetch).not.toHaveBeenCalled();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  test("uses one unsubscribe request with an active subscription", async () => {
    enablePushSubscription();

    await logout();

    expect(mockFetch).toHaveBeenCalledTimes(1);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  test("does not refresh notifications after successful logout", async () => {
    enablePushSubscription();

    await logout();

    expect(
      mockRefreshPush
    ).not.toHaveBeenCalled();
  });

  test("deduplicates ten simultaneous logout requests", async () => {
    enablePushSubscription();

    await Promise.all(
      Array.from(
        { length: 10 },
        () => logout()
      )
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);

    expect(mockSignOut).toHaveBeenCalledTimes(1);

    expectStoresReset();
    expectCachesCleared();
  });
});