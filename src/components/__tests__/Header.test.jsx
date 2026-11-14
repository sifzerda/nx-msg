// src/components/__tests__/Header.test.jsx

// guests see Login/Register, 
// auth users see Messages/Contacts
// logout clears app state

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Header from "../Header";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockSignOut = jest.fn();
const mockResetChat = jest.fn();
const mockResetContacts = jest.fn();
const mockResetPresence = jest.fn();
const mockClearProfiles = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/messages",
  useRouter: () => ({
    push: mockPush,
    replace: mockPush,
    refresh: mockRefresh,
  }),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: (...args) => mockSignOut(...args),
    },
  }),
}));

jest.mock("@/lib/messageProfiles", () => ({
  clearMessageProfileCache: () => mockClearProfiles(),
}));

jest.mock("@/store/useChatStore", () => ({
  __esModule: true,
  default: {
    getState: () => ({ reset: mockResetChat }),
  },
}));

jest.mock("@/store/useContactStore", () => ({
  __esModule: true,
  default: {
    getState: () => ({ reset: mockResetContacts }),
  },
}));

jest.mock("@/store/usePresenceStore", () => ({
  __esModule: true,
  default: {
    getState: () => ({ reset: mockResetPresence }),
  },
}));

jest.mock(
  "@/components/PushNotificationButton",
  () => ({
    __esModule: true,
    default: () => <button>Enable notifications</button>,
  })
);

describe("Header", () => {
  const user = {
    id: "user-123",
    username: "alex",
    display_name: "Alex",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
  });

  test("shows guest navigation when logged out", () => {
    render(<Header />);

    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Register")).toBeInTheDocument();
    expect(screen.queryByText("Logout")).not.toBeInTheDocument();
  });

  test("shows authenticated navigation", () => {
    render(<Header user={user} />);

    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("@alex")).toBeInTheDocument();
  });

  test("shows push notification controls", () => {
    render(<Header user={user} />);

    expect(
      screen.getByText("Enable notifications")
    ).toBeInTheDocument();
  });

  test("logs out and resets application stores", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: jest.fn().mockResolvedValue(null),
      },
    });

    render(<Header user={user} />);

    fireEvent.click(
      screen.getByRole("button", { name: /log out/i })
    );

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockResetChat).toHaveBeenCalled();
      expect(mockResetContacts).toHaveBeenCalled();
      expect(mockResetPresence).toHaveBeenCalled();
      expect(mockClearProfiles).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  test("does not reset stores when signout fails", async () => {
    mockSignOut.mockResolvedValue({
      error: new Error("Signout failed"),
    });

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<Header user={user} />);

    fireEvent.click(
      screen.getByRole("button", { name: /log out/i })
    );

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });

    expect(mockResetChat).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
