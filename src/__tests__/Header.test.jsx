// src/__tests__/Header.test.jsx

/** @jest-environment jsdom */

import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
  within,
} from "@testing-library/react";

/* -------------------- MOCKS -------------------- */

const mockLogout = jest.fn();
const mockRedirect = jest.fn();

let mockPathname = "/messages";

jest.doMock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

jest.doMock("next/link", () => ({
  __esModule: true,

  default: function MockLink(props) {
    const anchorProps = { ...props };

    delete anchorProps.prefetch;

    return <a {...anchorProps} />;
  },
}));

jest.doMock("@/lib/logout", () => ({
  logout: mockLogout,
  redirectAfterLogout: mockRedirect,
}));

const Header = require("@/components/Header").default;

/* -------------------- DATA -------------------- */

const USER = {
  id: "user-123",
  username: "alex",
  display_name: "Alex",
};

const LOGOUT_SUCCESS = {
  success: true,
  pushCleanupError: null,
};

const AUTH_LINKS = [
  ["Messages", "/messages"],
  ["Contacts", "/contacts"],
  ["Settings", "/settings"],
];

const GUEST_LINKS = [
  ["Login", "/login"],
  ["Register", "/register"],
];

/* -------------------- HELPERS -------------------- */

function setup(props = {}) {
  return render(<Header {...props} />);
}

function setupAuthenticated() {
  return setup({ user: USER });
}

function getNavigation() {
  return screen.getByRole("navigation", {
    name: "Main navigation",
  });
}

function getNavLink(name) {
  return within(getNavigation()).getByRole("link", {
    name,
  });
}

function queryNavLink(name) {
  return within(getNavigation()).queryByRole("link", {
    name,
  });
}

function getLogoutButton() {
  return screen.getByRole("button", {
    name: /^log out$/i,
  });
}

function getLoadingButton() {
  return screen.getByRole("button", {
    name: /^logging out$/i,
  });
}

function clickLogout() {
  fireEvent.click(getLogoutButton());
}

function deferred() {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function expectRedirect() {
  await waitFor(() => {
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });
}

async function expectLogoutError(message) {
  const alert = await screen.findByRole("alert");

  expect(alert).toHaveTextContent(message);

  return alert;
}

/* -------------------- SETUP -------------------- */

let errorSpy;
let warnSpy;

beforeEach(() => {
  jest.resetAllMocks();

  mockPathname = "/messages";

  mockLogout.mockResolvedValue(LOGOUT_SUCCESS);

  errorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});

  warnSpy = jest
    .spyOn(console, "warn")
    .mockImplementation(() => {});
});

afterEach(() => {
  cleanup();

  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

/* -------------------- GUEST NAVIGATION -------------------- */

describe("Header - guest navigation", () => {
  test.each(GUEST_LINKS)(
    "displays the %s link",
    (name, href) => {
      setup();

      expect(getNavLink(name)).toHaveAttribute(
        "href",
        href
      );
    }
  );

  test.each(AUTH_LINKS)(
    "does not display the %s link",
    (name) => {
      setup();

      expect(
        queryNavLink(name)
      ).not.toBeInTheDocument();
    }
  );

  test("does not display a logout button", () => {
    setup();

    expect(
      screen.queryByRole("button", {
        name: /^log out$/i,
      })
    ).not.toBeInTheDocument();
  });

  test("links the Messenger logo to Login", () => {
    setup();

    expect(
      screen.getByRole("link", {
        name: "Messenger home",
      })
    ).toHaveAttribute("href", "/login");
  });

  test("treats a null user as logged out", () => {
    setup({ user: null });

    for (const [name] of GUEST_LINKS) {
      expect(getNavLink(name)).toBeInTheDocument();
    }
  });
});

/* -------------------- AUTHENTICATED NAVIGATION -------------------- */

describe("Header - authenticated navigation", () => {
  test.each(AUTH_LINKS)(
    "displays the %s link",
    (name, href) => {
      setupAuthenticated();

      expect(getNavLink(name)).toHaveAttribute(
        "href",
        href
      );
    }
  );

  test.each(GUEST_LINKS)(
    "does not display the %s link",
    (name) => {
      setupAuthenticated();

      expect(
        queryNavLink(name)
      ).not.toBeInTheDocument();
    }
  );

  test("displays the logout button", () => {
    setupAuthenticated();

    expect(getLogoutButton()).toBeInTheDocument();
  });

  test("links the Messenger logo to Messages", () => {
    setupAuthenticated();

    expect(
      screen.getByRole("link", {
        name: "Messenger home",
      })
    ).toHaveAttribute("href", "/messages");
  });

  test("does not display obsolete notification controls", () => {
    setupAuthenticated();

    expect(
      screen.queryByRole("button", {
        name: /enable notifications/i,
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: /disable notifications/i,
      })
    ).not.toBeInTheDocument();
  });
});

/* -------------------- USER INFORMATION -------------------- */

describe("Header - user information", () => {
  test("displays the user's display name", () => {
    setupAuthenticated();

    expect(screen.getByText("Alex"))
      .toBeInTheDocument();
  });

  test("displays the username with an @ prefix", () => {
    setupAuthenticated();

    expect(screen.getByText("@alex"))
      .toBeInTheDocument();
  });

  test.each([null, undefined, ""])(
    "uses a fallback display name for %p",
    (displayName) => {
      setup({
        user: {
          ...USER,
          display_name: displayName,
        },
      });

      expect(screen.getByText("User"))
        .toBeInTheDocument();
    }
  );

  test.each([null, undefined, ""])(
    "uses a fallback username for %p",
    (username) => {
      setup({
        user: {
          ...USER,
          username,
        },
      });

      expect(screen.getByText("@unknown"))
        .toBeInTheDocument();
    }
  );

  test("does not display user information for guests", () => {
    setup();

    expect(screen.queryByText("@unknown"))
      .not.toBeInTheDocument();

    expect(screen.queryByText("User"))
      .not.toBeInTheDocument();
  });

  test("updates when the user changes", () => {
    const { rerender } = setupAuthenticated();

    rerender(
      <Header
        user={{
          id: "user-456",
          username: "jamie",
          display_name: "Jamie",
        }}
      />
    );

    expect(screen.getByText("Jamie"))
      .toBeInTheDocument();

    expect(screen.getByText("@jamie"))
      .toBeInTheDocument();

    expect(screen.queryByText("@alex"))
      .not.toBeInTheDocument();
  });
});

/* -------------------- ACTIVE NAVIGATION -------------------- */

describe("Header - active navigation", () => {
  test.each([
    ["/messages", "Messages"],
    ["/messages/chat-123", "Messages"],
    ["/contacts", "Contacts"],
    ["/contacts/user-123", "Contacts"],
    ["/settings", "Settings"],
    ["/settings/privacy", "Settings"],
    ["/settings/notifications", "Settings"],
  ])(
    "marks %s as active under %s",
    (pathname, label) => {
      mockPathname = pathname;

      setupAuthenticated();

      expect(getNavLink(label)).toHaveAttribute(
        "aria-current",
        "page"
      );
    }
  );

  test.each([
    "/messages-archive",
    "/unknown-page",
  ])(
    "does not mark unrelated route %s as active",
    (pathname) => {
      mockPathname = pathname;

      setupAuthenticated();

      expect(
        getNavigation().querySelector(
          '[aria-current="page"]'
        )
      ).toBeNull();
    }
  );

  test("does not mark unrelated links as active", () => {
    setupAuthenticated();

    for (const name of ["Contacts", "Settings"]) {
      expect(getNavLink(name))
        .not.toHaveAttribute("aria-current");
    }
  });

  test.each([
    ["/login", "Login"],
    ["/register", "Register"],
  ])(
    "marks guest route %s as active",
    (pathname, label) => {
      mockPathname = pathname;

      setup();

      expect(getNavLink(label)).toHaveAttribute(
        "aria-current",
        "page"
      );
    }
  );

  test("updates active navigation when the pathname changes", () => {
    const { rerender } = setupAuthenticated();

    expect(getNavLink("Messages")).toHaveAttribute(
      "aria-current",
      "page"
    );

    mockPathname = "/settings";

    rerender(<Header user={USER} />);

    expect(getNavLink("Settings")).toHaveAttribute(
      "aria-current",
      "page"
    );

    expect(getNavLink("Messages"))
      .not.toHaveAttribute("aria-current");
  });
});

/* -------------------- AUTHENTICATION TRANSITIONS -------------------- */

describe("Header - authentication transitions", () => {
  test("updates navigation after login", () => {
    const { rerender } = setup();

    rerender(<Header user={USER} />);

    expect(getNavLink("Messages"))
      .toBeInTheDocument();

    expect(getNavLink("Settings"))
      .toBeInTheDocument();

    expect(queryNavLink("Login"))
      .not.toBeInTheDocument();
  });

  test("updates navigation after logout", () => {
    const { rerender } = setupAuthenticated();

    rerender(<Header user={null} />);

    expect(getNavLink("Login"))
      .toBeInTheDocument();

    expect(queryNavLink("Messages"))
      .not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: /^log out$/i,
      })
    ).not.toBeInTheDocument();
  });
});

/* -------------------- LOGOUT SUCCESS -------------------- */

describe("Header - successful logout", () => {
  test("calls the centralised logout service once", async () => {
    setupAuthenticated();

    clickLogout();

    await expectRedirect();

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  test("redirects after logout", async () => {
    setupAuthenticated();

    clickLogout();

    await expectRedirect();

    expect(
      mockLogout.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockRedirect.mock.invocationCallOrder[0]
    );
  });

  test("does not display an error after successful logout", async () => {
    setupAuthenticated();

    clickLogout();

    await expectRedirect();

    expect(screen.queryByRole("alert"))
      .not.toBeInTheDocument();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("keeps the logout button disabled until navigation", async () => {
    setupAuthenticated();

    clickLogout();

    await expectRedirect();

    expect(getLoadingButton()).toBeDisabled();

    expect(getLoadingButton()).toHaveAttribute(
      "aria-busy",
      "true"
    );
  });
});

/* -------------------- LOGOUT LOADING -------------------- */

describe("Header - logout loading state", () => {
  test("starts with an enabled logout button", () => {
    setupAuthenticated();

    expect(getLogoutButton()).toBeEnabled();

    expect(getLogoutButton()).toHaveAttribute(
      "aria-busy",
      "false"
    );
  });

  test("displays the pending logout state", async () => {
    const request = deferred();

    mockLogout.mockReturnValueOnce(request.promise);

    setupAuthenticated();

    clickLogout();

    try {
      const button = getLoadingButton();

      expect(button).toBeDisabled();

      expect(button).toHaveAttribute(
        "aria-busy",
        "true"
      );

      expect(button).toHaveAttribute(
        "title",
        "Logging out..."
      );

      expect(screen.getByText("Logging out..."))
        .toBeInTheDocument();

      expect(mockRedirect).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        request.resolve(LOGOUT_SUCCESS);
        await request.promise;
      });
    }

    await expectRedirect();
  });

  test("prevents duplicate logout requests while pending", async () => {
    const request = deferred();

    mockLogout.mockReturnValueOnce(request.promise);

    setupAuthenticated();

    clickLogout();

    try {
      const button = getLoadingButton();

      for (let index = 0; index < 3; index++) {
        fireEvent.click(button);
      }

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockRedirect).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        request.resolve(LOGOUT_SUCCESS);
        await request.promise;
      });
    }

    await expectRedirect();
  });

  test("does not navigate before logout completes", async () => {
    const request = deferred();

    mockLogout.mockReturnValueOnce(request.promise);

    setupAuthenticated();

    clickLogout();

    try {
      expect(mockRedirect).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        request.resolve(LOGOUT_SUCCESS);
        await request.promise;
      });
    }

    await expectRedirect();
  });
});

/* -------------------- LOGOUT FAILURE -------------------- */

describe("Header - logout failure", () => {
  test("displays the logout error inline", async () => {
    mockLogout.mockRejectedValueOnce(
      new Error("Signout failed")
    );

    setupAuthenticated();

    clickLogout();

    await expectLogoutError("Signout failed");
  });

  test("logs the logout error", async () => {
    const error = new Error("Signout failed");

    mockLogout.mockRejectedValueOnce(error);

    setupAuthenticated();

    clickLogout();

    await expectLogoutError(error.message);

    expect(errorSpy).toHaveBeenCalledWith(
      "Logout failed:",
      error
    );
  });

  test("does not navigate after logout failure", async () => {
    mockLogout.mockRejectedValueOnce(
      new Error("Signout failed")
    );

    setupAuthenticated();

    clickLogout();

    await expectLogoutError("Signout failed");

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("uses a fallback error message when necessary", async () => {
    mockLogout.mockRejectedValueOnce(
      new Error("")
    );

    setupAuthenticated();

    clickLogout();

    await expectLogoutError("Could not log out.");
  });

  test("re-enables the logout button after failure", async () => {
    mockLogout.mockRejectedValueOnce(
      new Error("Signout failed")
    );

    setupAuthenticated();

    clickLogout();

    await expectLogoutError("Signout failed");

    expect(getLogoutButton()).toBeEnabled();

    expect(getLogoutButton()).toHaveAttribute(
      "aria-busy",
      "false"
    );
  });

  test("allows retrying a failed logout", async () => {
    mockLogout
      .mockRejectedValueOnce(
        new Error("Signout failed")
      )
      .mockResolvedValueOnce(LOGOUT_SUCCESS);

    setupAuthenticated();

    clickLogout();

    await expectLogoutError("Signout failed");

    expect(getLogoutButton()).toBeEnabled();

    clickLogout();

    await expectRedirect();

    expect(mockLogout).toHaveBeenCalledTimes(2);

    expect(screen.queryByRole("alert"))
      .not.toBeInTheDocument();
  });
});

/* -------------------- PUSH CLEANUP WARNINGS -------------------- */

describe("Header - push cleanup warnings", () => {
  const cleanupError = new Error(
    "Push subscription cleanup failed"
  );

  beforeEach(() => {
    mockLogout.mockResolvedValue({
      success: true,
      pushCleanupError: cleanupError,
    });
  });

  test("logs a warning when push cleanup fails", async () => {
    setupAuthenticated();

    clickLogout();

    await expectRedirect();

    expect(warnSpy).toHaveBeenCalledWith(
      "Push cleanup failed:",
      cleanupError
    );
  });

  test("still redirects after push cleanup failure", async () => {
    setupAuthenticated();

    clickLogout();

    await expectRedirect();
  });

  test("does not treat push cleanup failure as logout failure", async () => {
    setupAuthenticated();

    clickLogout();

    await expectRedirect();

    expect(screen.queryByRole("alert"))
      .not.toBeInTheDocument();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  test("does not retry logout because push cleanup failed", async () => {
    setupAuthenticated();

    clickLogout();

    await expectRedirect();

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});

/* -------------------- ACCESSIBILITY -------------------- */

describe("Header - accessibility", () => {
  test("renders a banner landmark", () => {
    setup();

    expect(screen.getByRole("banner"))
      .toBeInTheDocument();
  });

  test("provides a named navigation landmark", () => {
    setup();

    expect(getNavigation()).toBeInTheDocument();
  });

  test.each(AUTH_LINKS)(
    "provides an accessible name and tooltip for %s",
    (name) => {
      setupAuthenticated();

      const link = getNavLink(name);

      expect(link).toHaveAccessibleName(name);
      expect(link).toHaveAttribute("title", name);
    }
  );

  test("provides an accessible logout button", () => {
    setupAuthenticated();

    expect(getLogoutButton())
      .toHaveAccessibleName("Log out");
  });
});

/* -------------------- REQUEST EFFICIENCY -------------------- */

describe("Header - request efficiency", () => {
  test.each([null, USER])(
    "does not initiate logout or navigation on mount",
    (user) => {
      setup({ user });

      expect(mockLogout).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    }
  );

  test("does not initiate logout when the user changes", () => {
    const { rerender } = setupAuthenticated();

    rerender(
      <Header
        user={{
          ...USER,
          display_name: "Updated name",
        }}
      />
    );

    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  test("does not initiate logout when the route changes", () => {
    const { rerender } = setupAuthenticated();

    mockPathname = "/contacts";

    rerender(<Header user={USER} />);

    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});