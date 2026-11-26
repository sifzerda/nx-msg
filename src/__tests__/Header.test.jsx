// src/components/__tests__/Header.test.jsx

// guests see Login/Register, 
// auth users see Messages/Contacts
// logout clears app state

/** @jest-environment jsdom */

// src/__tests__/Header.test.jsx

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

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const mockBack = jest.fn();
const mockForward = jest.fn();
const mockPrefetch = jest.fn();

const mockLogout = jest.fn();

let mockPathname = "/messages";

const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  refresh: mockRefresh,
  back: mockBack,
  forward: mockForward,
  prefetch: mockPrefetch,
};

/* -------------------- NEXT NAVIGATION -------------------- */

jest.doMock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}));

/* -------------------- NEXT LINK -------------------- */

jest.doMock("next/link", () => ({
  __esModule: true,

  default: function MockLink({
    children,
    href,
    ...props
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

/* -------------------- LOGOUT SERVICE -------------------- */

jest.doMock("@/lib/logout", () => ({
  logout: mockLogout,
}));

/* -------------------- LOAD COMPONENT -------------------- */

const Header = require("@/components/Header").default;

/* -------------------- TEST DATA -------------------- */

const USER = {
  id: "user-123",
  username: "alex",
  display_name: "Alex",
};

const LOGOUT_SUCCESS = {
  success: true,
  pushCleanupError: null,
};

/* -------------------- HELPERS -------------------- */

function setup(props = {}) {
  return render(<Header {...props} />);
}

function getNavigation() {
  return screen.getByRole("navigation", {
    name: "Main navigation",
  });
}

function getNavLink(name) {
  return within(getNavigation()).getByRole(
    "link",
    { name }
  );
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

  return {
    promise,
    resolve,
    reject,
  };
}

/* -------------------- SETUP -------------------- */

let alertSpy;
let errorSpy;
let warnSpy;

beforeEach(() => {
  jest.clearAllMocks();

  mockPathname = "/messages";

  mockLogout.mockReset();
  mockLogout.mockResolvedValue(LOGOUT_SUCCESS);

  alertSpy = jest
    .spyOn(window, "alert")
    .mockImplementation(() => {});

  errorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});

  warnSpy = jest
    .spyOn(console, "warn")
    .mockImplementation(() => {});
});

afterEach(() => {
  cleanup();

  alertSpy.mockRestore();
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

/* -------------------- GUEST NAVIGATION -------------------- */

describe("Header - guest navigation", () => {
  test("displays the Login link", () => {
    setup();

    expect(
      getNavLink("Login")
    ).toHaveAttribute("href", "/login");
  });

  test("displays the Register link", () => {
    setup();

    expect(
      getNavLink("Register")
    ).toHaveAttribute("href", "/register");
  });

  test("does not display authenticated navigation", () => {
    setup();

    const navigation = within(getNavigation());

    expect(
      navigation.queryByRole("link", {
        name: "Messages",
      })
    ).not.toBeInTheDocument();

    expect(
      navigation.queryByRole("link", {
        name: "Contacts",
      })
    ).not.toBeInTheDocument();

    expect(
      navigation.queryByRole("link", {
        name: "Settings",
      })
    ).not.toBeInTheDocument();
  });

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
    setup({
      user: null,
    });

    expect(
      getNavLink("Login")
    ).toBeInTheDocument();

    expect(
      getNavLink("Register")
    ).toBeInTheDocument();
  });
});

/* -------------------- AUTHENTICATED NAVIGATION -------------------- */

describe("Header - authenticated navigation", () => {
  test("displays the Messages link", () => {
    setup({
      user: USER,
    });

    expect(
      getNavLink("Messages")
    ).toHaveAttribute("href", "/messages");
  });

  test("displays the Contacts link", () => {
    setup({
      user: USER,
    });

    expect(
      getNavLink("Contacts")
    ).toHaveAttribute("href", "/contacts");
  });

  test("displays the Settings link", () => {
    setup({
      user: USER,
    });

    expect(
      getNavLink("Settings")
    ).toHaveAttribute("href", "/settings");
  });

  test("does not display guest navigation", () => {
    setup({
      user: USER,
    });

    const navigation = within(getNavigation());

    expect(
      navigation.queryByRole("link", {
        name: "Login",
      })
    ).not.toBeInTheDocument();

    expect(
      navigation.queryByRole("link", {
        name: "Register",
      })
    ).not.toBeInTheDocument();
  });

  test("displays the logout button", () => {
    setup({
      user: USER,
    });

    expect(
      getLogoutButton()
    ).toBeInTheDocument();
  });

  test("links the Messenger logo to Messages", () => {
    setup({
      user: USER,
    });

    expect(
      screen.getByRole("link", {
        name: "Messenger home",
      })
    ).toHaveAttribute("href", "/messages");
  });

  test("does not display obsolete notification controls", () => {
    setup({
      user: USER,
    });

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
    setup({
      user: USER,
    });

    expect(
      screen.getByText("Alex")
    ).toBeInTheDocument();
  });

  test("displays the username with an @ prefix", () => {
    setup({
      user: USER,
    });

    expect(
      screen.getByText("@alex")
    ).toBeInTheDocument();
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

      expect(
        screen.getByText("User")
      ).toBeInTheDocument();
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

      expect(
        screen.getByText("@unknown")
      ).toBeInTheDocument();
    }
  );

  test("does not display user information for guests", () => {
    setup();

    expect(
      screen.queryByText("@unknown")
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText("User")
    ).not.toBeInTheDocument();
  });

  test("updates when the user changes", () => {
    const { rerender } = setup({
      user: USER,
    });

    rerender(
      <Header
        user={{
          id: "user-456",
          username: "jamie",
          display_name: "Jamie",
        }}
      />
    );

    expect(
      screen.getByText("Jamie")
    ).toBeInTheDocument();

    expect(
      screen.getByText("@jamie")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("@alex")
    ).not.toBeInTheDocument();
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

      setup({
        user: USER,
      });

      expect(
        getNavLink(label)
      ).toHaveAttribute(
        "aria-current",
        "page"
      );
    }
  );

  test("does not mark unrelated links as active", () => {
    mockPathname = "/messages";

    setup({
      user: USER,
    });

    expect(
      getNavLink("Contacts")
    ).not.toHaveAttribute("aria-current");

    expect(
      getNavLink("Settings")
    ).not.toHaveAttribute("aria-current");
  });

  test("does not incorrectly match similar route names", () => {
    mockPathname = "/messages-archive";

    setup({
      user: USER,
    });

    expect(
      getNavLink("Messages")
    ).not.toHaveAttribute("aria-current");
  });

  test("does not mark any link active on unrelated pages", () => {
    mockPathname = "/unknown-page";

    setup({
      user: USER,
    });

    expect(
      getNavigation().querySelector(
        '[aria-current="page"]'
      )
    ).toBeNull();
  });

  test.each([
    ["/login", "Login"],
    ["/register", "Register"],
  ])(
    "marks guest route %s as active",
    (pathname, label) => {
      mockPathname = pathname;

      setup();

      expect(
        getNavLink(label)
      ).toHaveAttribute(
        "aria-current",
        "page"
      );
    }
  );

  test("updates active navigation when the pathname changes", () => {
    const { rerender } = setup({
      user: USER,
    });

    expect(
      getNavLink("Messages")
    ).toHaveAttribute(
      "aria-current",
      "page"
    );

    mockPathname = "/settings";

    rerender(
      <Header user={USER} />
    );

    expect(
      getNavLink("Settings")
    ).toHaveAttribute(
      "aria-current",
      "page"
    );

    expect(
      getNavLink("Messages")
    ).not.toHaveAttribute("aria-current");
  });
});

/* -------------------- AUTHENTICATION TRANSITIONS -------------------- */

describe("Header - authentication transitions", () => {
  test("updates navigation after login", () => {
    const { rerender } = setup();

    rerender(
      <Header user={USER} />
    );

    expect(
      getNavLink("Messages")
    ).toBeInTheDocument();

    expect(
      getNavLink("Settings")
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("link", {
        name: "Login",
      })
    ).not.toBeInTheDocument();
  });

  test("updates navigation after logout", () => {
    const { rerender } = setup({
      user: USER,
    });

    rerender(
      <Header user={null} />
    );

    expect(
      getNavLink("Login")
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("link", {
        name: "Messages",
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: /^log out$/i,
      })
    ).not.toBeInTheDocument();
  });
});

/* -------------------- LOGOUT SUCCESS -------------------- */

describe("Header - successful logout", () => {
  test("does not initiate logout on mount", () => {
    setup({
      user: USER,
    });

    expect(mockLogout).not.toHaveBeenCalled();
  });

  test("calls the centralised logout service", async () => {
    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);

      expect(mockReplace).toHaveBeenCalledWith(
        "/login"
      );
    });
  });

  test("replaces the current route with Login", async () => {
    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/login"
      );
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("refreshes the router after logout", async () => {
    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  test("replaces the route before refreshing", async () => {
    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });

    expect(
      mockReplace.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockRefresh.mock.invocationCallOrder[0]
    );
  });

  test("does not display an error after successful logout", async () => {
    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

/* -------------------- LOGOUT LOADING STATE -------------------- */

describe("Header - logout loading state", () => {
  test("starts with an enabled logout button", () => {
    setup({
      user: USER,
    });

    expect(
      getLogoutButton()
    ).toBeEnabled();

    expect(
      getLogoutButton()
    ).toHaveAttribute(
      "aria-busy",
      "false"
    );
  });

  test("disables the button while logging out", async () => {
    const request = deferred();

    mockLogout.mockReturnValueOnce(
      request.promise
    );

    setup({
      user: USER,
    });

    clickLogout();

    try {
      expect(
        getLoadingButton()
      ).toBeDisabled();
    } finally {
      await act(async () => {
        request.resolve(LOGOUT_SUCCESS);
        await request.promise;
      });
    }
  });

  test("marks the logout button as busy", async () => {
    const request = deferred();

    mockLogout.mockReturnValueOnce(
      request.promise
    );

    setup({
      user: USER,
    });

    clickLogout();

    try {
      expect(
        getLoadingButton()
      ).toHaveAttribute(
        "aria-busy",
        "true"
      );
    } finally {
      await act(async () => {
        request.resolve(LOGOUT_SUCCESS);
        await request.promise;
      });
    }
  });

  test("displays the logging out message", async () => {
    const request = deferred();

    mockLogout.mockReturnValueOnce(
      request.promise
    );

    setup({
      user: USER,
    });

    clickLogout();

    try {
      expect(
        screen.getByText("Logging out...")
      ).toBeInTheDocument();

      expect(
        getLoadingButton()
      ).toHaveAttribute(
        "title",
        "Logging out..."
      );
    } finally {
      await act(async () => {
        request.resolve(LOGOUT_SUCCESS);
        await request.promise;
      });
    }
  });

  test("prevents duplicate logout requests while pending", async () => {
    const request = deferred();

    mockLogout.mockReturnValueOnce(
      request.promise
    );

    setup({
      user: USER,
    });

    clickLogout();

    try {
      const button = getLoadingButton();

      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockLogout).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        request.resolve(LOGOUT_SUCCESS);
        await request.promise;
      });
    }
  });

  test("does not navigate before logout completes", async () => {
    const request = deferred();

    mockLogout.mockReturnValueOnce(
      request.promise
    );

    setup({
      user: USER,
    });

    clickLogout();

    try {
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        request.resolve(LOGOUT_SUCCESS);
        await request.promise;
      });
    }

    expect(mockReplace).toHaveBeenCalledWith(
      "/login"
    );
  });

  test("clears the loading state after completion", async () => {
    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(
        getLogoutButton()
      ).toBeEnabled();

      expect(
        getLogoutButton()
      ).toHaveAttribute(
        "aria-busy",
        "false"
      );
    });
  });
});

/* -------------------- LOGOUT FAILURE -------------------- */

describe("Header - logout failure", () => {
  test("displays the logout error message", async () => {
    mockLogout.mockRejectedValueOnce(
      new Error("Signout failed")
    );

    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Signout failed"
      );
    });
  });

  test("logs the logout error", async () => {
    const error = new Error(
      "Signout failed"
    );

    mockLogout.mockRejectedValueOnce(error);

    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        "Logout failed:",
        error
      );
    });
  });

  test("does not navigate after logout failure", async () => {
    mockLogout.mockRejectedValueOnce(
      new Error("Signout failed")
    );

    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("uses a fallback error message when necessary", async () => {
    mockLogout.mockRejectedValueOnce(
      new Error("")
    );

    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Could not log out"
      );
    });
  });

  test("re-enables the logout button after failure", async () => {
    mockLogout.mockRejectedValueOnce(
      new Error("Signout failed")
    );

    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(
        getLogoutButton()
      ).toBeEnabled();

      expect(
        getLogoutButton()
      ).toHaveAttribute(
        "aria-busy",
        "false"
      );
    });
  });

  test("allows retrying a failed logout", async () => {
    mockLogout
      .mockRejectedValueOnce(
        new Error("Signout failed")
      )
      .mockResolvedValueOnce(
        LOGOUT_SUCCESS
      );

    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();

      expect(
        getLogoutButton()
      ).toBeEnabled();
    });

    clickLogout();

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(2);

      expect(mockReplace).toHaveBeenCalledWith(
        "/login"
      );
    });
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
    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "Logout completed, but push cleanup had an error:",
        cleanupError
      );
    });
  });

  test("still redirects to Login", async () => {
    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/login"
      );
    });
  });

  test("still refreshes the router", async () => {
    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  test("does not treat push cleanup failure as logout failure", async () => {
    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test("does not retry logout because push cleanup failed", async () => {
    setup({
      user: USER,
    });

    clickLogout();

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});

/* -------------------- ACCESSIBILITY -------------------- */

describe("Header - accessibility", () => {
  test("renders a banner landmark", () => {
    setup();

    expect(
      screen.getByRole("banner")
    ).toBeInTheDocument();
  });

  test("provides a named navigation landmark", () => {
    setup();

    expect(
      getNavigation()
    ).toBeInTheDocument();
  });

  test("provides accessible names for authenticated links", () => {
    setup({
      user: USER,
    });

    for (const name of [
      "Messages",
      "Contacts",
      "Settings",
    ]) {
      expect(
        getNavLink(name)
      ).toHaveAccessibleName(name);
    }
  });

  test("provides an accessible logout button", () => {
    setup({
      user: USER,
    });

    expect(
      getLogoutButton()
    ).toHaveAccessibleName("Log out");
  });

  test("provides navigation tooltips", () => {
    setup({
      user: USER,
    });

    for (const name of [
      "Messages",
      "Contacts",
      "Settings",
    ]) {
      expect(
        getNavLink(name)
      ).toHaveAttribute("title", name);
    }
  });
});

/* -------------------- REQUEST EFFICIENCY -------------------- */

describe("Header - request efficiency", () => {
  test("does not call logout when rendering a guest", () => {
    setup();

    expect(mockLogout).not.toHaveBeenCalled();
  });

  test("does not call logout when the user changes", () => {
    const { rerender } = setup({
      user: USER,
    });

    rerender(
      <Header
        user={{
          ...USER,
          display_name: "Updated name",
        }}
      />
    );

    expect(mockLogout).not.toHaveBeenCalled();
  });

  test("does not call logout when the route changes", () => {
    const { rerender } = setup({
      user: USER,
    });

    mockPathname = "/contacts";

    rerender(
      <Header user={USER} />
    );

    expect(mockLogout).not.toHaveBeenCalled();
  });

  test("does not navigate or refresh automatically on mount", () => {
    setup({
      user: USER,
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});