/** @jest-environment node */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
} from "@jest/globals";

const mockExchangeCodeForSession = jest.fn();
const mockVerifyOtp = jest.fn();
const mockCreateClient = jest.fn();

let GET;

const ORIGIN = "http://localhost:3000";

const SUCCESS_URL =
  `${ORIGIN}/reset-password`;

const FAILURE_URL =
  `${ORIGIN}/forgot-password?error=invalid_recovery`;

const USER = {
  id: "user-123",
  email: "user@example.com",
};

const SESSION = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  user: USER,
};

const SUCCESS_RESULT = {
  data: {
    session: SESSION,
    user: USER,
  },
  error: null,
};

/* -------------------- HELPERS -------------------- */

function createRequest(query = "") {
  return new Request(
    `${ORIGIN}/auth/confirm${query}`
  );
}

async function execute(query = "") {
  return GET(createRequest(query));
}

function expectRedirect(response, destination) {
  expect(response.status).toBe(307);

  expect(
    response.headers.get("location")
  ).toBe(destination);

  expect(
    response.headers.get("cache-control")
  ).toBe("no-store");

  expect(
    response.headers.get("referrer-policy")
  ).toBe("no-referrer");
}

/* -------------------- SETUP -------------------- */

/* -------------------- SETUP -------------------- */

beforeEach(() => {
  jest.resetModules();
  jest.resetAllMocks();

  mockExchangeCodeForSession.mockResolvedValue(SUCCESS_RESULT);

  mockVerifyOtp.mockResolvedValue(SUCCESS_RESULT);

   mockCreateClient.mockResolvedValue({
    auth: {
      exchangeCodeForSession:
        mockExchangeCodeForSession,

      verifyOtp:
        mockVerifyOtp,
    },
  });

  jest.doMock("@/lib/supabase/server", () => ({
    __esModule: true,
    createClient: mockCreateClient,
  }));

  ({ GET } = require("@/app/auth/confirm/route"));
});

/* -------------------- PKCE RECOVERY -------------------- */

describe("PKCE recovery callback", () => {
  test("exchanges a valid recovery code", async () => {
    const response = await execute(
      "?code=valid-code"
    );

    expect(
      mockExchangeCodeForSession
    ).toHaveBeenCalledTimes(1);

    expect(
      mockExchangeCodeForSession
    ).toHaveBeenCalledWith("valid-code");

    expect(
      mockVerifyOtp
    ).not.toHaveBeenCalled();

    expectRedirect(
      response,
      SUCCESS_URL
    );
  });

  test("rejects an expired code", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: {
        message: "Code expired",
      },
    });

    const response = await execute(
      "?code=expired-code"
    );

    expectRedirect(
      response,
      FAILURE_URL
    );
  });

  test("rejects a previously used code", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: {
        message: "Invalid or used code",
      },
    });

    const response = await execute(
      "?code=used-code"
    );

    expectRedirect(
      response,
      FAILURE_URL
    );
  });

  test("handles a rejected exchange request", async () => {
    mockExchangeCodeForSession.mockRejectedValue(
      new Error("Network failure")
    );

    const response = await execute(
      "?code=valid-code"
    );

    expectRedirect(
      response,
      FAILURE_URL
    );
  });

  test("passes decoded codes to Supabase", async () => {
    await execute(
      "?code=abc%2B123%3D"
    );

    expect(
      mockExchangeCodeForSession
    ).toHaveBeenCalledWith("abc+123=");
  });
});

/* -------------------- TOKEN RECOVERY -------------------- */

describe("recovery token verification", () => {
  test("verifies a valid recovery token", async () => {
    const response = await execute(
      "?token_hash=valid-token&type=recovery"
    );

    expect(
      mockVerifyOtp
    ).toHaveBeenCalledTimes(1);

    expect(
      mockVerifyOtp
    ).toHaveBeenCalledWith({
      token_hash: "valid-token",
      type: "recovery",
    });

    expect(
      mockExchangeCodeForSession
    ).not.toHaveBeenCalled();

    expectRedirect(
      response,
      SUCCESS_URL
    );
  });

  test("rejects an expired recovery token", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: {
        message: "Token expired",
      },
    });

    const response = await execute(
      "?token_hash=expired-token&type=recovery"
    );

    expectRedirect(
      response,
      FAILURE_URL
    );
  });

  test("rejects a previously used token", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: {
        message: "Token already used",
      },
    });

    const response = await execute(
      "?token_hash=used-token&type=recovery"
    );

    expectRedirect(
      response,
      FAILURE_URL
    );
  });

  test("handles token verification exceptions", async () => {
    mockVerifyOtp.mockRejectedValue(
      new Error("Verification failed")
    );

    const response = await execute(
      "?token_hash=valid-token&type=recovery"
    );

    expectRedirect(
      response,
      FAILURE_URL
    );
  });

  test("prefers recovery token verification when both credentials exist", async () => {
    const response = await execute(
      "?code=valid-code&token_hash=valid-token&type=recovery"
    );

    expect(
      mockVerifyOtp
    ).toHaveBeenCalledTimes(1);

    expect(
      mockExchangeCodeForSession
    ).not.toHaveBeenCalled();

    expectRedirect(
      response,
      SUCCESS_URL
    );
  });

  test("does not fall back to code exchange after failed token verification", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: {
        message: "Invalid token",
      },
    });

    const response = await execute(
      "?code=valid-code&token_hash=invalid-token&type=recovery"
    );

    expect(
      mockExchangeCodeForSession
    ).not.toHaveBeenCalled();

    expectRedirect(
      response,
      FAILURE_URL
    );
  });
});

/* -------------------- INVALID REQUESTS -------------------- */

describe("invalid recovery requests", () => {
  test.each([
    "",
    "?code=",
    "?token_hash=",
    "?type=recovery",
    "?token_hash=valid-token",
    "?token_hash=&type=recovery",
    "?token_hash=valid-token&type=",
    "?token_hash=valid-token&type=signup",
    "?token_hash=valid-token&type=invite",
    "?token_hash=valid-token&type=magiclink",
    "?token_hash=valid-token&type=email",
    "?token_hash=valid-token&type=email_change",
    "?token_hash=valid-token&type=invalid",
    "?token_hash=valid-token&type=RECOVERY",
    "?unrelated=value",
    "?error=access_denied",
  ])(
    "rejects invalid query %p without contacting Supabase",
    async (query) => {
      const response = await execute(query);

      expectRedirect(
        response,
        FAILURE_URL
      );

      expect(
        mockCreateClient
      ).not.toHaveBeenCalled();

      expect(
        mockExchangeCodeForSession
      ).not.toHaveBeenCalled();

      expect(
        mockVerifyOtp
      ).not.toHaveBeenCalled();
    }
  );
});

/* -------------------- SESSION VALIDATION -------------------- */

describe.each([
  [
    "PKCE",
    "?code=valid-code",
    () => mockExchangeCodeForSession,
  ],
  [
    "token",
    "?token_hash=valid-token&type=recovery",
    () => mockVerifyOtp,
  ],
])(
  "%s session validation",
  (name, query, getMock) => {
    test.each([
      {
        session: null,
        user: USER,
      },
      {
        session: SESSION,
        user: null,
      },
      {
        session: null,
        user: null,
      },
      {},
      null,
    ])(
      "rejects incomplete authentication data %p",
      async (data) => {
        getMock().mockResolvedValue({
          data,
          error: null,
        });

        const response = await execute(query);

        expectRedirect(
          response,
          FAILURE_URL
        );
      }
    );

    test("rejects authentication errors even when session data exists", async () => {
      getMock().mockResolvedValue({
        data: {
          session: SESSION,
          user: USER,
        },
        error: {
          message: "Authentication failed",
        },
      });

      const response = await execute(query);

      expectRedirect(
        response,
        FAILURE_URL
      );
    });
  }
);

/* -------------------- REDIRECT SECURITY -------------------- */

describe("recovery redirect security", () => {
  test.each([
    "https://malicious.example",
    "//malicious.example",
    "/admin",
    "/messages",
    "javascript:alert(1)",
  ])(
    "ignores external or unexpected next parameter %p",
    async (destination) => {
      const response = await execute(
        `?code=valid-code&next=${encodeURIComponent(
          destination
        )}`
      );

      expectRedirect(
        response,
        SUCCESS_URL
      );
    }
  );

  test("ignores redirect_to parameters", async () => {
    const response = await execute(
      "?code=valid-code&redirect_to=https://malicious.example"
    );

    expectRedirect(
      response,
      SUCCESS_URL
    );
  });

  test("removes recovery codes from destination URLs", async () => {
    const response = await execute(
      "?code=secret-recovery-code"
    );

    const location =
      response.headers.get("location");

    expect(location).toBe(SUCCESS_URL);

    expect(location).not.toContain(
      "secret-recovery-code"
    );
  });

  test("removes recovery token hashes from destination URLs", async () => {
    const response = await execute(
      "?token_hash=secret-token&type=recovery"
    );

    const location =
      response.headers.get("location");

    expect(location).toBe(SUCCESS_URL);

    expect(location).not.toContain(
      "secret-token"
    );
  });

  test("does not expose Supabase error details", async () => {
    mockVerifyOtp.mockResolvedValue({
      data: {
        session: null,
        user: null,
      },
      error: {
        message: "Sensitive internal error",
      },
    });

    const response = await execute(
      "?token_hash=invalid&type=recovery"
    );

    expectRedirect(
      response,
      FAILURE_URL
    );

    expect(
      response.headers.get("location")
    ).not.toContain("Sensitive");
  });

  test("preserves the deployment origin", async () => {
    const request = new Request(
      "https://messenger.example/auth/confirm?code=valid-code"
    );

    const response = await GET(request);

    expectRedirect(
      response,
      "https://messenger.example/reset-password"
    );
  });
});

/* -------------------- CLIENT FAILURES -------------------- */

describe("Supabase client failures", () => {
  test("handles server client initialization failures", async () => {
    mockCreateClient.mockRejectedValue(
      new Error("Client initialization failed")
    );

    const response = await execute(
      "?code=valid-code"
    );

    expectRedirect(
      response,
      FAILURE_URL
    );
  });

  test("handles malformed Supabase clients", async () => {
    mockCreateClient.mockResolvedValue({});

    const response = await execute(
      "?code=valid-code"
    );

    expectRedirect(
      response,
      FAILURE_URL
    );
  });

  test("creates only one Supabase client per valid request", async () => {
    await execute("?code=valid-code");

    expect(
      mockCreateClient
    ).toHaveBeenCalledTimes(1);
  });
});