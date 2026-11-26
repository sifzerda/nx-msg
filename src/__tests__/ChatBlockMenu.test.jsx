// src/__tests__/ChatBlockMenu.test.jsx

/** @jest-environment jsdom */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "@jest/globals";

import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";

/* -------------------- MOCK BLOCK STORE -------------------- */

const { create } = require("zustand");

const mockBlock = jest.fn();
const mockUnblock = jest.fn();

function createMockStoreState() {
  return {
    block: mockBlock,
    unblock: mockUnblock,
    pendingUsers: {},
    blockedUsers: [],
    loading: false,
    error: null,
  };
}

const mockUseBlockStore = create(createMockStoreState);

jest.doMock("@/store/useBlockStore", () => ({
  __esModule: true,
  default: mockUseBlockStore,
}));

/* -------------------- LOAD COMPONENT -------------------- */

const ChatBlockMenu = require("@/components/extras/ChatBlockMenu").default;

/* -------------------- CONSTANTS -------------------- */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const DISPLAY_NAME = "Alex Morgan";

/* -------------------- DIALOG POLYFILLS -------------------- */

let originalShowModal;
let originalClose;

beforeAll(() => {
  originalShowModal = HTMLDialogElement.prototype.showModal;
  originalClose = HTMLDialogElement.prototype.close;

  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", "") };

  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterAll(() => {
  if (originalShowModal) {
    HTMLDialogElement.prototype.showModal = originalShowModal;
  } else {
    delete HTMLDialogElement.prototype.showModal;
  }

  if (originalClose) {
    HTMLDialogElement.prototype.close = originalClose;
  } else {
    delete HTMLDialogElement.prototype.close;
  }
});

/* -------------------- HELPERS -------------------- */

function setup(overrides = {}) {
  const props = {
    userId: USER_ID,
    displayName: DISPLAY_NAME,
    isBlocked: false,
    ...overrides,
  };

  const rendered = render(
    <ChatBlockMenu {...props} />
  );

  return {
    ...rendered,

    updateProps(nextProps = {}) {
      Object.assign(props, nextProps);

      rendered.rerender(
        <ChatBlockMenu {...props} />
      );
    },

    updateStore(nextState = {}) {
      act(() => {
        mockUseBlockStore.setState(nextState);
      });
    },
  };
}

function getMenuButton() {
  return screen.getByRole("button", {
    name: /options|menu|more/i,
  });
}

function openMenu() {
  fireEvent.click(getMenuButton());
}

function getActionButton(action = "block") {
  const pattern = action === "unblock" ? /^unblock\b/i : /^block\b/i;

  return screen.getByRole("button", {
    name: pattern,
  });
}

function getDialog() {
  return screen.getByRole("dialog");
}

function openConfirmation(action = "block") {
  openMenu();

  fireEvent.click(getActionButton(action));

  return getDialog();
}

function getConfirmButton(action = "block") {
  const pattern = action === "unblock" ? /^unblock\b/i : /^block\b/i;

  return within(getDialog()).getByRole(
    "button", { name: pattern }
  );
}

function getCancelButton() {
  return within(getDialog()).getByRole(
    "button", { name: /cancel/i }
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

/* -------------------- SETUP -------------------- */

beforeEach(() => {
  jest.clearAllMocks();

  mockBlock.mockReset();
  mockUnblock.mockReset();

  mockBlock.mockResolvedValue(true);
  mockUnblock.mockResolvedValue(true);

  mockUseBlockStore.setState(
    createMockStoreState(),
    true
  );
});

afterEach(() => {
  cleanup();
});

/* -------------------- INITIAL RENDERING -------------------- */

describe("Initial rendering", () => {
  test("renders the options button", () => {
    setup();
    expect(getMenuButton()).toBeInTheDocument();
  });

  test("does not display the menu initially", () => {
    setup();
    expect(screen.queryByRole("button", { name: /^block\b/i })).not.toBeInTheDocument();
  });

  test("does not display a confirmation dialog initially", () => {
    setup();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("does not perform a block operation on mount", () => {
    setup();

    expect(mockBlock).not.toHaveBeenCalled();
    expect(mockUnblock).not.toHaveBeenCalled();
  });
});

/* -------------------- MENU BEHAVIOUR -------------------- */

describe("Menu behaviour", () => {
  test("opens the options menu", () => {
    setup();

    openMenu();

    expect(getActionButton("block")).toBeInTheDocument();
  });

  test("closes the menu when toggled again", () => {
    setup();

    openMenu();

    fireEvent.click(getMenuButton());

    expect(
      screen.queryByRole("button", {
        name: /^block\b/i,
      })
    ).not.toBeInTheDocument();
  });

  test("shows block for an unblocked user", () => {
    setup({
      isBlocked: false,
    });

    openMenu();

    expect(getActionButton("block")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: /^unblock\b/i,
      })
    ).not.toBeInTheDocument();
  });

  test("shows unblock for a blocked user", () => {
    setup({
      isBlocked: true,
    });

    openMenu();

    expect(getActionButton("unblock")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: /^block\b/i,
      })
    ).not.toBeInTheDocument();
  });

  test("closes the menu when clicking outside", () => {
    setup();

    openMenu();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("button", {
      name: /^block\b/i,
    })
    ).not.toBeInTheDocument();
  });

  test("closes the menu when Escape is pressed", () => {
    setup();

    openMenu();

    fireEvent.keyDown(document, {
      key: "Escape",
    });

    expect(screen.queryByRole("button", {
      name: /^block\b/i,
    })
    ).not.toBeInTheDocument();
  });
});

/* -------------------- BLOCK CONFIRMATION -------------------- */

describe("Block confirmation", () => {
  test("opens a block confirmation dialog", () => {
    setup();

    openConfirmation("block");

    expect(getDialog()).toBeInTheDocument();
  });

  test("identifies the user being blocked", () => {
    setup();

    const dialog = openConfirmation("block");
    expect(dialog).toHaveTextContent(DISPLAY_NAME);
  });

  test("does not block until confirmation", () => {
    setup();

    openConfirmation("block");
    expect(mockBlock).not.toHaveBeenCalled();
  });

  test("displays a confirmation button", () => {
    setup();

    openConfirmation("block");

    expect(getConfirmButton("block")).toBeInTheDocument();
  });

  test("displays a cancellation button", () => {
    setup();

    openConfirmation("block");

    expect(getCancelButton()).toBeInTheDocument();
  });

  test("cancels without blocking the user", async () => {
    setup();

    openConfirmation("block");

    fireEvent.click(getCancelButton());

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(mockBlock).not.toHaveBeenCalled();
  });

  test("blocks the correct user after confirmation", async () => {
    setup();

    openConfirmation("block");

    fireEvent.click(getConfirmButton("block"));

    await waitFor(() => {
      expect(mockBlock).toHaveBeenCalledWith(
        USER_ID
      );
    });

    expect(mockBlock).toHaveBeenCalledTimes(1);
    expect(mockUnblock).not.toHaveBeenCalled();
  });

  test("closes the dialog after a successful block", async () => {
    setup();

    openConfirmation("block");

    fireEvent.click(getConfirmButton("block"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

/* -------------------- UNBLOCK CONFIRMATION -------------------- */

describe("Unblock confirmation", () => {
  test("opens an unblock confirmation dialog", () => {
    setup({
      isBlocked: true,
    });

    openConfirmation("unblock");
    expect(getDialog()).toBeInTheDocument();
  });

  test("identifies the user being unblocked", () => {
    setup({
      isBlocked: true,
    });

    const dialog = openConfirmation("unblock");
    expect(dialog).toHaveTextContent(DISPLAY_NAME);
  });

  test("does not unblock until confirmation", () => {
    setup({
      isBlocked: true,
    });

    openConfirmation("unblock");
    expect(mockUnblock).not.toHaveBeenCalled();
  });

  test("cancels without unblocking", async () => {
    setup({
      isBlocked: true,
    });

    openConfirmation("unblock");

    fireEvent.click(getCancelButton());

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(mockUnblock).not.toHaveBeenCalled();
  });

  test("unblocks the correct user", async () => {
    setup({
      isBlocked: true,
    });

    openConfirmation("unblock");

    fireEvent.click(getConfirmButton("unblock"));

    await waitFor(() => {
      expect(mockUnblock).toHaveBeenCalledWith(USER_ID);
    });

    expect(mockUnblock).toHaveBeenCalledTimes(1);
    expect(mockBlock).not.toHaveBeenCalled();
  });

  test("closes the dialog after a successful unblock", async () => {
    setup({
      isBlocked: true,
    });

    openConfirmation("unblock");

    fireEvent.click(getConfirmButton("unblock"));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

/* -------------------- PENDING OPERATIONS -------------------- */

describe("Pending operations", () => {
  test("disables confirmation while blocking is pending", async () => {
    const request = deferred();
    mockBlock.mockReturnValueOnce(request.promise);

    const { updateStore } = setup();
    openConfirmation("block");

    const confirmButton = getConfirmButton("block");

    fireEvent.click(confirmButton);

    updateStore({
      pendingUsers: {
        [USER_ID]: "block",
      },
    });

    try {
      expect(confirmButton).toBeDisabled();
    } finally {
      await act(async () => {
        request.resolve(true);
        await request.promise;
      });
    }
  });

  test("disables cancellation during a pending operation", async () => {
    const request = deferred();
    mockBlock.mockReturnValueOnce(request.promise);

    const { updateStore } = setup();
    openConfirmation("block");

    fireEvent.click(getConfirmButton("block"));

    updateStore({
      pendingUsers: {
        [USER_ID]: "block",
      },
    });

    try {
      expect(getCancelButton()).toBeDisabled();
    } finally {
      await act(async () => {
        request.resolve(true);
        await request.promise;
      });
    }
  });

  test("prevents duplicate block submissions", async () => {
    const request = deferred();
    mockBlock.mockReturnValueOnce(request.promise);

    const { updateStore } = setup();
    openConfirmation("block");

    const confirmButton = getConfirmButton("block");
    fireEvent.click(confirmButton);

    updateStore({
      pendingUsers: {
        [USER_ID]: "block",
      },
    });

    try {
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);

      expect(mockBlock).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        request.resolve(true);
        await request.promise;
      });
    }
  });

  test("prevents duplicate unblock submissions", async () => {
    const request = deferred();
    mockUnblock.mockReturnValueOnce(request.promise);

    const { updateStore } = setup({
      isBlocked: true,
    });

    openConfirmation("unblock");

    const confirmButton = getConfirmButton("unblock");
    fireEvent.click(confirmButton);

    updateStore({
      pendingUsers: {
        [USER_ID]: "unblock",
      },
    });

    try {
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);

      expect(mockUnblock).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        request.resolve(true);
        await request.promise;
      });
    }
  });

  test("does not disable actions for unrelated pending users", () => {
    mockUseBlockStore.setState({
      pendingUsers: {
        [OTHER_USER_ID]: "block",
      },
    });

    setup();

    openConfirmation("block");

    expect(
      getConfirmButton("block")
    ).not.toBeDisabled();
  });

  test("prevents native dialog cancellation while pending", async () => {
    const request = deferred();
    mockBlock.mockReturnValueOnce(request.promise);

    const { updateStore } = setup();
    openConfirmation("block");

    fireEvent.click(getConfirmButton("block"));

    updateStore({
      pendingUsers: {
        [USER_ID]: "block",
      },
    });

    try {
      const event = new Event("cancel", {
        bubbles: false,
        cancelable: true,
      });

      fireEvent(getDialog(), event);

      expect(event.defaultPrevented).toBe(true);
      expect(getDialog()).toBeInTheDocument();
    } finally {
      await act(async () => {
        request.resolve(true);
        await request.promise;
      });
    }
  });
});

/* -------------------- ERROR HANDLING -------------------- */

describe("Error handling", () => {
  test("displays a failed block operation", async () => {
    mockBlock.mockRejectedValueOnce(new Error("Unable to block user"));

    setup();

    openConfirmation("block");

    fireEvent.click(getConfirmButton("block"));

    expect(await screen.findByText("Unable to block user")).toBeInTheDocument();
  });

  test("displays a failed unblock operation", async () => {
    mockUnblock.mockRejectedValueOnce(new Error("Unable to unblock user"));

    setup({
      isBlocked: true,
    });

    openConfirmation("unblock");

    fireEvent.click(getConfirmButton("unblock"));

    expect(await screen.findByText("Unable to unblock user")).toBeInTheDocument();
  });

  test("keeps the confirmation dialog open after failure", async () => {
    mockBlock.mockRejectedValueOnce(new Error("Operation failed"));

    setup();

    openConfirmation("block");

    fireEvent.click(getConfirmButton("block"));

    await screen.findByText("Operation failed");

    expect(getDialog()).toBeInTheDocument();
  });

  test("allows retrying a failed operation", async () => {
    mockBlock
      .mockRejectedValueOnce(new Error("Operation failed"))
      .mockResolvedValueOnce(true);

    setup();

    openConfirmation("block");

    fireEvent.click(getConfirmButton("block"));

    await screen.findByText("Operation failed");

    fireEvent.click(getConfirmButton("block"));

    await waitFor(() => {
      expect(mockBlock).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  test("allows cancelling after an operation fails", async () => {
    mockBlock.mockRejectedValueOnce(new Error("Operation failed"));

    setup();

    openConfirmation("block");

    fireEvent.click(getConfirmButton("block"));

    await screen.findByText("Operation failed");

    fireEvent.click(getCancelButton());

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  test("clears old errors when reopening confirmation", async () => {
    mockBlock.mockRejectedValueOnce(new Error("Previous operation failed"));

    setup();

    openConfirmation("block");

    fireEvent.click(getConfirmButton("block"));

    await screen.findByText("Previous operation failed");

    fireEvent.click(getCancelButton());

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    openConfirmation("block");
    expect(screen.queryByText("Previous operation failed")).not.toBeInTheDocument();
  });
});

/* -------------------- PROP UPDATES -------------------- */

describe("Block status updates", () => {
  test("updates the menu after a user becomes blocked", () => {
    const { updateProps } = setup({
      isBlocked: false,
    });

    updateProps({
      isBlocked: true,
    });

    openMenu();

    expect(getActionButton("unblock")).toBeInTheDocument();
  });

  test("updates the menu after a user becomes unblocked", () => {
    const { updateProps } = setup({
      isBlocked: true,
    });

    updateProps({
      isBlocked: false,
    });

    openMenu();

    expect(getActionButton("block")).toBeInTheDocument();
  });

  test("uses the updated target user ID", async () => {
    const { updateProps } = setup();

    updateProps({
      userId: OTHER_USER_ID,
    });

    openConfirmation("block");

    fireEvent.click(getConfirmButton("block"));

    await waitFor(() => {
      expect(mockBlock).toHaveBeenCalledWith(OTHER_USER_ID);
    });

    expect(mockBlock).not.toHaveBeenCalledWith(USER_ID);
  });

  test("uses the updated display name", () => {
    const { updateProps } = setup();

    updateProps({
      displayName: "Jamie Lee",
    });

    const dialog = openConfirmation("block");

    expect(dialog).toHaveTextContent("Jamie Lee");
  });
});

/* -------------------- COMPONENT CLEANUP -------------------- */

describe("Component cleanup", () => {
  test("removes the outside pointer listener on unmount", () => {
    const addSpy = jest.spyOn(document, "addEventListener");
    const removeSpy = jest.spyOn(document, "removeEventListener");

    try {
      const { unmount } = setup();

      openMenu();

      const registrations = addSpy.mock.calls.filter(([type]) => type === "pointerdown");
      expect(registrations.length).toBeGreaterThan(0);

      unmount();

      for (const [, listener] of registrations) {
        expect(
          removeSpy.mock.calls.some(([type, callback]) => type === "pointerdown" && callback === listener)).toBe(true);
      }
    } finally {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });

  test("removes the keyboard listener on unmount", () => {
    const addSpy = jest.spyOn(document, "addEventListener");
    const removeSpy = jest.spyOn(document, "removeEventListener");

    try {
      const { unmount } = setup();

      openMenu();

      const registrations = addSpy.mock.calls.filter(([type]) => type === "keydown");
      expect(registrations.length).toBeGreaterThan(0);

      unmount();

      for (const [, listener] of registrations) {
        expect(
          removeSpy.mock.calls.some(([type, callback]) => type === "keydown" && callback === listener)).toBe(true);
      }
    } finally {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });

  test("does not initiate a block operation when unmounted", () => {
    const { unmount } = setup();

    openConfirmation("block");

    unmount();

    expect(mockBlock).not.toHaveBeenCalled();
    expect(mockUnblock).not.toHaveBeenCalled();
  });
});