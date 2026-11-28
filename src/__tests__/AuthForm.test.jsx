/** @jest-environment jsdom */

// src/__tests__/AuthForm.test.jsx

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
} from "@jest/globals";

import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";

import "@testing-library/jest-dom";

/* -------------------- MOCKS -------------------- */

const mockAuth = {
  signInWithPassword: jest.fn(),
  signUp: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  updateUser: jest.fn(),
  getUser: jest.fn(),
};

const mockCreateClient = jest.fn();
const mockLogout = jest.fn();
const mockNotifySessionChange = jest.fn();
const mockRedirectAfterAuth = jest.fn();

jest.doMock("@/lib/supabase/client", () => ({
  createClient: mockCreateClient,
}));

jest.doMock("@/lib/logout", () => ({
  logout: mockLogout,
  notifySessionChange: mockNotifySessionChange,
  redirectAfterAuth: mockRedirectAfterAuth,
}));

jest.doMock("next/link", () => ({
  __esModule: true,

  default: function MockLink({
    href,
    children,
    prefetch,
    ...props
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

const AuthForm =
  require("@/components/AuthForm").default;

/* -------------------- FIXTURES -------------------- */

const EMAIL = "user@example.com";
const PASSWORD = "SecurePassword123!";
const USER_ID = "user-123";

const USER = {
  id: USER_ID,
  email: EMAIL,
};

const SESSION = {
  user: USER,
  access_token: "test-access-token",
};

const AUTH_SUCCESS = {
  data: {
    user: USER,
    session: SESSION,
  },
  error: null,
};

const RECOVERY_SUCCESS = {
  data: {},
  error: null,
};

const RECOVERY_MESSAGE =
  /if an account exists for this email address/i;

const INVALID_SESSION_MESSAGE =
  /recovery session is invalid or has expired/i;

/* -------------------- SETUP -------------------- */

beforeEach(() => {
  jest.resetAllMocks();

  mockCreateClient.mockReturnValue({
    auth: mockAuth,
  });

  mockAuth.signInWithPassword.mockResolvedValue(
    AUTH_SUCCESS
  );

  mockAuth.signUp.mockResolvedValue(
    AUTH_SUCCESS
  );

  mockAuth.resetPasswordForEmail.mockResolvedValue(
    RECOVERY_SUCCESS
  );

  mockAuth.getUser.mockResolvedValue({
    data: { user: USER },
    error: null,
  });

  mockAuth.updateUser.mockResolvedValue({
    data: { user: USER },
    error: null,
  });

  mockLogout.mockResolvedValue({
    success: true,
    pushCleanupError: null,
  });
});

/* -------------------- HELPERS -------------------- */

function renderForm(mode = "login", props = {}) {
  const result = render(
    <AuthForm
      mode={mode}
      recoveryUserId={USER_ID}
      {...props}
    />
  );

  return {
    ...result,
    form: result.container.querySelector("form"),
  };
}

function getInput(label) {
  return screen.getByLabelText(label, {
    exact: true,
  });
}

function fillInput(label, value) {
  fireEvent.change(getInput(label), {
    target: { value },
  });
}

function fillCredentials({
  email = EMAIL,
  password = PASSWORD,
} = {}) {
  fillInput("Email address", email);
  fillInput("Password", password);
}

function fillRegistration({
  email = EMAIL,
  password = PASSWORD,
  confirmation = password,
} = {}) {
  fillCredentials({ email, password });

  fillInput(
    "Confirm password",
    confirmation
  );
}

function fillReset({
  password = PASSWORD,
  confirmation = password,
} = {}) {
  fillInput("New password", password);

  fillInput(
    "Confirm password",
    confirmation
  );
}

function submit(form) {
  fireEvent.submit(form);
}

async function expectError(message) {
  expect(
    await screen.findByRole("alert")
  ).toHaveTextContent(message);
}

async function expectRedirect(destination) {
  await waitFor(() => {
    expect(mockRedirectAfterAuth)
      .toHaveBeenCalledWith(destination);
  });
}

function expectNoNavigation() {
  expect(mockRedirectAfterAuth)
    .not.toHaveBeenCalled();
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

/* -------------------- RENDERING -------------------- */

describe("Authentication form rendering", () => {
  test.each([
    ["login", "Welcome Back", "Log In"],
    ["register", "Create Account", "Register"],
    ["forgot", "Forgot Password", "Send Recovery Email"],
    ["reset", "Reset Password", "Update Password"],
  ])(
    "renders the %s form",
    (mode, heading, button) => {
      renderForm(mode);

      expect(
        screen.getByRole("heading", {
          name: heading,
        })
      ).toBeInTheDocument();

      expect(
        screen.getByRole("button", {
          name: button,
        })
      ).toBeInTheDocument();
    }
  );

  test("login displays the correct fields", () => {
    renderForm("login");

    expect(
      getInput("Email address")
    ).toBeInTheDocument();

    expect(
      getInput("Password")
    ).toBeInTheDocument();

    expect(
      screen.queryByLabelText("Confirm password")
    ).not.toBeInTheDocument();
  });

  test("registration displays password confirmation", () => {
    renderForm("register");

    expect(
      getInput("Email address")
    ).toBeInTheDocument();

    expect(
      getInput("Password")
    ).toBeInTheDocument();

    expect(
      getInput("Confirm password")
    ).toBeInTheDocument();
  });

  test("forgot password only displays email", () => {
    renderForm("forgot");

    expect(
      getInput("Email address")
    ).toBeInTheDocument();

    expect(
      screen.queryByLabelText("Password", {
        exact: true,
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByLabelText("Confirm password")
    ).not.toBeInTheDocument();
  });

  test("reset password does not display email", () => {
    renderForm("reset");

    expect(
      getInput("New password")
    ).toBeInTheDocument();

    expect(
      getInput("Confirm password")
    ).toBeInTheDocument();

    expect(
      screen.queryByLabelText("Email address")
    ).not.toBeInTheDocument();
  });

  test.each([
    ["login", "Register", "/register"],
    ["login", "Forgot password?", "/forgot-password"],
    ["register", "Log in", "/login"],
    ["forgot", "Log in", "/login"],
    ["reset", "Request one", "/forgot-password"],
  ])(
    "%s displays the %s link",
    (mode, name, href) => {
      renderForm(mode);

      expect(
        screen.getByRole("link", { name })
      ).toHaveAttribute("href", href);
    }
  );

  test.each([
    ["login", "Password", "current-password"],
    ["register", "Password", "new-password"],
    ["register", "Confirm password", "new-password"],
    ["reset", "New password", "new-password"],
    ["reset", "Confirm password", "new-password"],
  ])(
    "%s uses correct autocomplete for %s",
    (mode, label, autocomplete) => {
      renderForm(mode);

      expect(
        getInput(label)
      ).toHaveAttribute(
        "autocomplete",
        autocomplete
      );
    }
  );

  test("email uses email autocomplete", () => {
    renderForm("login");

    expect(
      getInput("Email address")
    ).toHaveAttribute(
      "autocomplete",
      "email"
    );
  });
});

/* -------------------- STATUS MESSAGES -------------------- */

describe("Authentication status messages", () => {
  test("displays registration confirmation", () => {
    renderForm("login", {
      registered: true,
    });

    expect(
      screen.getByRole("status")
    ).toHaveTextContent(
      /registration submitted/i
    );
  });

  test("displays password reset confirmation", () => {
    renderForm("login", {
      passwordReset: true,
    });

    expect(
      screen.getByRole("status")
    ).toHaveTextContent(
      /password has been updated successfully/i
    );
  });

  test("displays invalid recovery link message", () => {
    renderForm("forgot", {
      recoveryError: true,
    });

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent(
      /recovery link is invalid or has expired/i
    );
  });
});

/* -------------------- VALIDATION -------------------- */

describe("Authentication validation", () => {
  test.each([
    "login",
    "register",
    "forgot",
  ])(
    "%s rejects empty email",
    async (mode) => {
      const { form } = renderForm(mode);

      submit(form);

      await expectError(
        "Email address is required."
      );

      expect(mockCreateClient)
        .not.toHaveBeenCalled();
    }
  );

  test.each([
    "login",
    "register",
    "reset",
  ])(
    "%s rejects empty password",
    async (mode) => {
      const { form } = renderForm(mode);

      if (mode !== "reset") {
        fillInput("Email address", EMAIL);
      }

      submit(form);

      await expectError(
        "Password is required."
      );

      expect(mockCreateClient)
        .not.toHaveBeenCalled();
    }
  );

  test.each([
    "register",
    "reset",
  ])(
    "%s rejects short passwords",
    async (mode) => {
      const { form } = renderForm(mode);

      const fill = mode === "register"
        ? fillRegistration
        : fillReset;

      fill({
        password: "12345",
      });

      submit(form);

      await expectError(
        /at least 6 characters/i
      );

      expect(mockCreateClient)
        .not.toHaveBeenCalled();
    }
  );

  test.each([
    "register",
    "reset",
  ])(
    "%s rejects mismatched passwords",
    async (mode) => {
      const { form } = renderForm(mode);

      const fill = mode === "register"
        ? fillRegistration
        : fillReset;

      fill({
        confirmation: "DifferentPassword",
      });

      submit(form);

      await expectError(
        "Passwords do not match."
      );

      expect(mockCreateClient)
        .not.toHaveBeenCalled();
    }
  );
});

/* -------------------- LOGIN -------------------- */

describe("Login submission", () => {
  test("logs in successfully", async () => {
    const { form } = renderForm("login");

    fillCredentials();
    submit(form);

    await expectRedirect("/messages");

    expect(mockAuth.signInWithPassword)
      .toHaveBeenCalledTimes(1);

    expect(mockAuth.signInWithPassword)
      .toHaveBeenCalledWith({
        email: EMAIL,
        password: PASSWORD,
      });

    expect(mockNotifySessionChange)
      .toHaveBeenCalledTimes(1);

    expect(mockAuth.signUp)
      .not.toHaveBeenCalled();
  });

  test("trims email addresses", async () => {
    const { form } = renderForm("login");

    fillCredentials({
      email: `  ${EMAIL}  `,
    });

    submit(form);

    await expectRedirect("/messages");

    expect(mockAuth.signInWithPassword)
      .toHaveBeenCalledWith({
        email: EMAIL,
        password: PASSWORD,
      });
  });

  test("preserves password whitespace", async () => {
    const { form } = renderForm("login");

    const password = "  password  ";

    fillCredentials({ password });
    submit(form);

    await expectRedirect("/messages");

    expect(mockAuth.signInWithPassword)
      .toHaveBeenCalledWith({
        email: EMAIL,
        password,
      });
  });

  test("handles invalid credentials", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: {
        user: null,
        session: null,
      },
      error: {
        message: "Invalid login credentials",
      },
    });

    const { form } = renderForm("login");

    fillCredentials();
    submit(form);

    await expectError(
      "Invalid login credentials"
    );

    expectNoNavigation();

    expect(mockNotifySessionChange)
      .not.toHaveBeenCalled();
  });

  test("rejects login without a session", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: {
        user: USER,
        session: null,
      },
      error: null,
    });

    const { form } = renderForm("login");

    fillCredentials();
    submit(form);

    await expectError(
      /unable to establish an authenticated session/i
    );

    expectNoNavigation();
  });

  test("handles rejected authentication requests", async () => {
    mockAuth.signInWithPassword.mockRejectedValue(
      new Error("Network unavailable")
    );

    const { form } = renderForm("login");

    fillCredentials();
    submit(form);

    await expectError(
      "Network unavailable"
    );

    expectNoNavigation();

    expect(
      screen.getByRole("button", {
        name: "Log In",
      })
    ).toBeEnabled();
  });

  test("prevents duplicate login submissions", async () => {
    const request = deferred();

    mockAuth.signInWithPassword.mockReturnValue(
      request.promise
    );

    const { form } = renderForm("login");

    fillCredentials();

    submit(form);
    submit(form);

    expect(mockAuth.signInWithPassword)
      .toHaveBeenCalledTimes(1);

    expect(form).toHaveAttribute(
      "aria-busy",
      "true"
    );

    expect(
      getInput("Email address")
    ).toBeDisabled();

    expect(
      getInput("Password")
    ).toBeDisabled();

    await act(async () => {
      request.resolve(AUTH_SUCCESS);
    });

    await expectRedirect("/messages");
  });
});

/* -------------------- REGISTRATION -------------------- */

describe("Registration submission", () => {
  test("registers and redirects authenticated users", async () => {
    const { form } = renderForm("register");

    fillRegistration();
    submit(form);

    await expectRedirect("/messages");

    expect(mockAuth.signUp)
      .toHaveBeenCalledWith({
        email: EMAIL,
        password: PASSWORD,
      });

    expect(mockNotifySessionChange)
      .toHaveBeenCalledTimes(1);

    expect(mockAuth.signInWithPassword)
      .not.toHaveBeenCalled();
  });

  test("handles required email confirmation", async () => {
    mockAuth.signUp.mockResolvedValue({
      data: {
        user: USER,
        session: null,
      },
      error: null,
    });

    const { form } = renderForm("register");

    fillRegistration();
    submit(form);

    await expectRedirect(
      "/login?registered=true"
    );

    expect(mockNotifySessionChange)
      .not.toHaveBeenCalled();
  });

  test("accepts the minimum password length", async () => {
    const { form } = renderForm("register");

    fillRegistration({
      password: "123456",
    });

    submit(form);

    await expectRedirect("/messages");

    expect(mockAuth.signUp)
      .toHaveBeenCalledWith({
        email: EMAIL,
        password: "123456",
      });
  });

  test("handles registration errors", async () => {
    mockAuth.signUp.mockResolvedValue({
      data: null,
      error: {
        message: "Registration failed",
      },
    });

    const { form } = renderForm("register");

    fillRegistration();
    submit(form);

    await expectError(
      "Registration failed"
    );

    expectNoNavigation();

    expect(mockNotifySessionChange)
      .not.toHaveBeenCalled();
  });

  test("prevents duplicate registration submissions", async () => {
    const request = deferred();

    mockAuth.signUp.mockReturnValue(
      request.promise
    );

    const { form } = renderForm("register");

    fillRegistration();

    submit(form);
    submit(form);

    expect(mockAuth.signUp)
      .toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve(AUTH_SUCCESS);
    });

    await expectRedirect("/messages");
  });
});

/* -------------------- FORGOT PASSWORD -------------------- */

describe("Password recovery email", () => {
  test("requests recovery using the correct callback", async () => {
    const { form } = renderForm("forgot");

    fillInput("Email address", EMAIL);
    submit(form);

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent(
      RECOVERY_MESSAGE
    );

    expect(mockAuth.resetPasswordForEmail)
      .toHaveBeenCalledTimes(1);

    expect(mockAuth.resetPasswordForEmail)
      .toHaveBeenCalledWith(
        EMAIL,
        {
          redirectTo:
            `${window.location.origin}/auth/confirm`,
        }
      );

    expectNoNavigation();

    expect(mockNotifySessionChange)
      .not.toHaveBeenCalled();
  });

  test("trims recovery email addresses", async () => {
    const { form } = renderForm("forgot");

    fillInput(
      "Email address",
      `  ${EMAIL}  `
    );

    submit(form);

    await screen.findByRole("status");

    expect(mockAuth.resetPasswordForEmail)
      .toHaveBeenCalledWith(
        EMAIL,
        expect.any(Object)
      );
  });

  test("does not reveal whether an account exists", async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: {
        code: "user_not_found",
        message: "User does not exist",
      },
    });

    const { form } = renderForm("forgot");

    fillInput("Email address", EMAIL);
    submit(form);

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent(
      RECOVERY_MESSAGE
    );

    expect(
      screen.queryByRole("alert")
    ).not.toBeInTheDocument();

    expect(mockAuth.resetPasswordForEmail)
      .toHaveBeenCalledTimes(1);
  });

  test("handles recovery email rate limits", async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: {
        status: 429,
        message: "Rate limit exceeded",
      },
    });

    const { form } = renderForm("forgot");

    fillInput("Email address", EMAIL);
    submit(form);

    await expectError(
      /too many recovery requests/i
    );

    expectNoNavigation();
  });

  test("does not expose returned internal recovery errors", async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: {
        message: "Sensitive internal error",
      },
    });

    const { form } = renderForm("forgot");

    fillInput("Email address", EMAIL);
    submit(form);

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(
      /unable to process the recovery request/i
    );

    expect(alert).not.toHaveTextContent(
      "Sensitive internal error"
    );
  });

  test("handles rejected recovery requests", async () => {
    mockAuth.resetPasswordForEmail.mockRejectedValue(
      new Error("Network unavailable")
    );

    const { form } = renderForm("forgot");

    fillInput("Email address", EMAIL);
    submit(form);

    await expectError("Network unavailable");

    expectNoNavigation();
  });

  test("allows retrying after a failed recovery request", async () => {
    mockAuth.resetPasswordForEmail
      .mockResolvedValueOnce({
        data: null,
        error: {
          status: 429,
        },
      });

    const { form } = renderForm("forgot");

    fillInput("Email address", EMAIL);
    submit(form);

    await expectError(
      /too many recovery requests/i
    );

    submit(form);

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent(
      RECOVERY_MESSAGE
    );

    expect(
      screen.queryByRole("alert")
    ).not.toBeInTheDocument();

    expect(mockAuth.resetPasswordForEmail)
      .toHaveBeenCalledTimes(2);
  });

  test("prevents duplicate recovery requests", async () => {
    const request = deferred();

    mockAuth.resetPasswordForEmail.mockReturnValue(
      request.promise
    );

    const { form } = renderForm("forgot");

    fillInput("Email address", EMAIL);

    submit(form);
    submit(form);

    expect(mockAuth.resetPasswordForEmail)
      .toHaveBeenCalledTimes(1);

    expect(
      screen.getByRole("button", {
        name: "Sending email...",
      })
    ).toBeDisabled();

    expect(
      getInput("Email address")
    ).toBeDisabled();

    await act(async () => {
      request.resolve(RECOVERY_SUCCESS);
    });

    expect(
      screen.getByRole("button", {
        name: "Send Recovery Email",
      })
    ).toBeEnabled();

    expect(form).toHaveAttribute(
      "aria-busy",
      "false"
    );
  });
});

/* -------------------- RESET PASSWORD -------------------- */

describe("Password reset submission", () => {
  test.each([
    {
      data: { user: null },
      error: null,
    },
    {
      data: { user: null },
      error: {
        message: "Session expired",
      },
    },
    {
      data: {
        user: {
          id: "different-user",
        },
      },
      error: null,
    },
  ])(
    "rejects invalid recovery sessions %p",
    async (result) => {
      mockAuth.getUser.mockResolvedValue(
        result
      );

      const { form } = renderForm("reset");

      fillReset();
      submit(form);

      await expectError(
        INVALID_SESSION_MESSAGE
      );

      expect(mockAuth.getUser)
        .toHaveBeenCalledTimes(1);

      expect(mockAuth.updateUser)
        .not.toHaveBeenCalled();

      expect(mockLogout)
        .not.toHaveBeenCalled();

      expectNoNavigation();
    }
  );

  test("rejects a missing recovery user ID", async () => {
    const { form } = renderForm("reset", {
      recoveryUserId: null,
    });

    fillReset();
    submit(form);

    await expectError(
      INVALID_SESSION_MESSAGE
    );

    expect(mockAuth.updateUser)
      .not.toHaveBeenCalled();

    expect(mockLogout)
      .not.toHaveBeenCalled();
  });

  test("updates the password and signs out", async () => {
    const { form } = renderForm("reset");

    fillReset();
    submit(form);

    await expectRedirect(
      "/login?passwordReset=true"
    );

    expect(mockAuth.getUser)
      .toHaveBeenCalledTimes(1);

    expect(mockAuth.updateUser)
      .toHaveBeenCalledTimes(1);

    expect(mockAuth.updateUser)
      .toHaveBeenCalledWith({
        password: PASSWORD,
      });

    expect(mockLogout)
      .toHaveBeenCalledTimes(1);
  });

  test("verifies identity before updating the password", async () => {
    const { form } = renderForm("reset");

    fillReset();
    submit(form);

    await expectRedirect(
      "/login?passwordReset=true"
    );

    expect(
      mockAuth.getUser.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockAuth.updateUser.mock.invocationCallOrder[0]
    );
  });

  test("updates the password before logging out", async () => {
    const { form } = renderForm("reset");

    fillReset();
    submit(form);

    await expectRedirect(
      "/login?passwordReset=true"
    );

    expect(
      mockAuth.updateUser.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockLogout.mock.invocationCallOrder[0]
    );

    expect(
      mockLogout.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockRedirectAfterAuth.mock.invocationCallOrder[0]
    );
  });

  test("does not log out after a failed password update", async () => {
    mockAuth.updateUser.mockResolvedValue({
      data: null,
      error: {
        message: "Password update failed",
      },
    });

    const { form } = renderForm("reset");

    fillReset();
    submit(form);

    await expectError(
      "Password update failed"
    );

    expect(mockLogout)
      .not.toHaveBeenCalled();

    expectNoNavigation();

    expect(
      getInput("New password")
    ).toBeEnabled();
  });

  test("handles rejected password update requests", async () => {
    mockAuth.updateUser.mockRejectedValue(
      new Error("Network unavailable")
    );

    const { form } = renderForm("reset");

    fillReset();
    submit(form);

    await expectError(
      "Network unavailable"
    );

    expect(mockLogout)
      .not.toHaveBeenCalled();

    expectNoNavigation();
  });

  test("allows retrying a failed password update", async () => {
    mockAuth.updateUser.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Password update failed",
      },
    });

    const { form } = renderForm("reset");

    fillReset();
    submit(form);

    await expectError(
      "Password update failed"
    );

    submit(form);

    await expectRedirect(
      "/login?passwordReset=true"
    );

    expect(mockAuth.updateUser)
      .toHaveBeenCalledTimes(2);

    expect(mockLogout)
      .toHaveBeenCalledTimes(1);
  });

  test("prevents duplicate password updates", async () => {
    const request = deferred();

    mockAuth.updateUser.mockReturnValue(
      request.promise
    );

    const { form } = renderForm("reset");

    fillReset();

    submit(form);
    submit(form);

    await waitFor(() => {
      expect(mockAuth.updateUser)
        .toHaveBeenCalledTimes(1);
    });

    expect(mockAuth.getUser)
      .toHaveBeenCalledTimes(1);

    expect(
      screen.getByRole("button", {
        name: "Updating password...",
      })
    ).toBeDisabled();

    await act(async () => {
      request.resolve({
        data: { user: USER },
        error: null,
      });
    });

    await expectRedirect(
      "/login?passwordReset=true"
    );
  });

  test("waits for logout before redirecting", async () => {
    const request = deferred();

    mockLogout.mockReturnValue(
      request.promise
    );

    const { form } = renderForm("reset");

    fillReset();
    submit(form);

    await waitFor(() => {
      expect(mockLogout)
        .toHaveBeenCalledTimes(1);
    });

    expectNoNavigation();

    await act(async () => {
      request.resolve({
        success: true,
        pushCleanupError: null,
      });
    });

    await expectRedirect(
      "/login?passwordReset=true"
    );
  });

  test("allows retrying logout without updating the password again", async () => {
    mockLogout.mockRejectedValueOnce(
      new Error("Sign out failed")
    );

    const { form } = renderForm("reset");

    fillReset();
    submit(form);

    await expectError(
      "Sign out failed"
    );

    expect(
      screen.getByRole("status")
    ).toHaveTextContent(
      /password updated/i
    );

    expect(
      screen.queryByLabelText("New password")
    ).not.toBeInTheDocument();

    expect(
      screen.queryByLabelText("Confirm password")
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Return to login",
      })
    ).toBeEnabled();

    expectNoNavigation();

    submit(form);

    await expectRedirect(
      "/login?passwordReset=true"
    );

    expect(mockAuth.getUser)
      .toHaveBeenCalledTimes(1);

    expect(mockAuth.updateUser)
      .toHaveBeenCalledTimes(1);

    expect(mockLogout)
      .toHaveBeenCalledTimes(2);
  });

  test("redirects when logout succeeds despite push cleanup errors", async () => {
    mockLogout.mockResolvedValue({
      success: true,
      pushCleanupError: new Error(
        "Push cleanup failed"
      ),
    });

    const { form } = renderForm("reset");

    fillReset();
    submit(form);

    await expectRedirect(
      "/login?passwordReset=true"
    );

    expect(mockAuth.updateUser)
      .toHaveBeenCalledTimes(1);

    expect(mockLogout)
      .toHaveBeenCalledTimes(1);
  });
});

/* -------------------- SHARED ERROR HANDLING -------------------- */

describe("Shared authentication error handling", () => {
  test("handles client initialization failures", async () => {
    mockCreateClient.mockImplementation(() => {
      throw new Error(
        "Unable to initialize authentication"
      );
    });

    const { form } = renderForm("login");

    fillCredentials();
    submit(form);

    await expectError(
      "Unable to initialize authentication"
    );

    expectNoNavigation();

    expect(
      screen.getByRole("button", {
        name: "Log In",
      })
    ).toBeEnabled();
  });

  test("uses a fallback message for unknown errors", async () => {
    mockAuth.signInWithPassword.mockRejectedValue(
      {}
    );

    const { form } = renderForm("login");

    fillCredentials();
    submit(form);

    await expectError(
      "Authentication failed. Please try again."
    );

    expectNoNavigation();
  });

  test("clears previous errors when retrying", async () => {
    mockAuth.signInWithPassword
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "Invalid credentials",
        },
      });

    const { form } = renderForm("login");

    fillCredentials();
    submit(form);

    await expectError(
      "Invalid credentials"
    );

    submit(form);

    await expectRedirect("/messages");

    expect(
      screen.queryByRole("alert")
    ).not.toBeInTheDocument();
  });
});