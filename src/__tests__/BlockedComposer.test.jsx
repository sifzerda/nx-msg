// src/__tests__/BlockedComposer.test.jsx

/** @jest-environment jsdom */

import {
  describe,
  test,
  expect,
  afterEach,
} from "@jest/globals";

import {
  render,
  screen,
  cleanup,
} from "@testing-library/react";

import BlockedComposer from "@/components/BlockedComposer";

/* -------------------- HELPERS -------------------- */

function setup(overrides = {}) {
  const props = {
    isBlockedByMe: false,
    messagingUnavailable: true,
    ...overrides,
  };

  const rendered = render(<BlockedComposer {...props} />);

  return {
    ...rendered,

    updateProps(nextProps = {}) {
      Object.assign(props, nextProps);

      rendered.rerender(<BlockedComposer {...props} />);
    },
  };
}

afterEach(() => {
  cleanup();
});

/* -------------------- LOADING PERMISSIONS -------------------- */

describe("Loading messaging permissions", () => {
  test("displays a permission loading message", () => {
    setup({
      messagingUnavailable: false,
    });

    expect(
      screen.getByText(/checking|loading/i)
    ).toBeInTheDocument();
  });

  test("does not display the blocked-user message while loading", () => {
    setup({
      messagingUnavailable: false,
    });

    expect(
      screen.queryByText(
        /you have blocked this user/i
      )
    ).not.toBeInTheDocument();
  });

  test("does not display the unavailable message while loading", () => {
    setup({
      messagingUnavailable: false,
    });

    expect(
      screen.queryByText(
        /^messaging is unavailable$/i
      )
    ).not.toBeInTheDocument();
  });

  test("does not expose a message input while loading", () => {
    setup({
      messagingUnavailable: false,
    });

    expect(
      screen.queryByRole("textbox")
    ).not.toBeInTheDocument();
  });

  test("does not expose a send button while loading", () => {
    setup({
      messagingUnavailable: false,
    });

    expect(
      screen.queryByRole("button", {
        name: /send/i,
      })
    ).not.toBeInTheDocument();
  });
});

/* -------------------- BLOCKED BY CURRENT USER -------------------- */

describe("User blocked by the current user", () => {
  test("displays the blocked-user message", () => {
    setup({
      isBlockedByMe: true,
    });

    expect(
      screen.getByText(
        /you have blocked this user/i
      )
    ).toBeInTheDocument();
  });

  test("explains how to unblock the user", () => {
    setup({
      isBlockedByMe: true,
    });

    expect(
      screen.getByText(/unblock/i)
    ).toBeInTheDocument();
  });

  test("does not display the loading message", () => {
    setup({
      isBlockedByMe: true,
    });

    expect(
      screen.queryByText(/checking|loading/i)
    ).not.toBeInTheDocument();
  });

  test("does not expose a message input", () => {
    setup({
      isBlockedByMe: true,
    });

    expect(
      screen.queryByRole("textbox")
    ).not.toBeInTheDocument();
  });

  test("does not expose a send button", () => {
    setup({
      isBlockedByMe: true,
    });

    expect(
      screen.queryByRole("button", {
        name: /send/i,
      })
    ).not.toBeInTheDocument();
  });
});

/* -------------------- MESSAGING UNAVAILABLE -------------------- */

describe("Messaging unavailable", () => {
  test("displays the generic unavailable message", () => {
    setup({
      isBlockedByMe: false,
      messagingUnavailable: true,
    });

    expect(
      screen.getByText(
        /^messaging is unavailable$/i
      )
    ).toBeInTheDocument();
  });

  test("explains that messages cannot currently be sent", () => {
    setup();

    expect(
      screen.getByText(
        /cannot currently send messages/i
      )
    ).toBeInTheDocument();
  });

  test("does not claim the current user blocked someone", () => {
    setup();

    expect(
      screen.queryByText(
        /you have blocked this user/i
      )
    ).not.toBeInTheDocument();
  });

  test("does not explicitly reveal that another user blocked them", () => {
    const { container } = setup();

    expect(container).not.toHaveTextContent(
      /has blocked you|you have been blocked|blocked by this user/i
    );
  });

  test("does not suggest unblocking a user they have not blocked", () => {
    setup();

    expect(
      screen.queryByText(/unblock/i)
    ).not.toBeInTheDocument();
  });

  test("does not expose a message input", () => {
    setup();

    expect(
      screen.queryByRole("textbox")
    ).not.toBeInTheDocument();
  });

  test("does not expose a send button", () => {
    setup();

    expect(
      screen.queryByRole("button", {
        name: /send/i,
      })
    ).not.toBeInTheDocument();
  });
});

/* -------------------- PROP TRANSITIONS -------------------- */

describe("Permission state transitions", () => {
  test("updates from loading to blocked", () => {
    const { updateProps } = setup({
      messagingUnavailable: false,
    });

    updateProps({
      isBlockedByMe: true,
      messagingUnavailable: true,
    });

    expect(
      screen.getByText(
        /you have blocked this user/i
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/checking|loading/i)
    ).not.toBeInTheDocument();
  });

  test("updates from loading to unavailable", () => {
    const { updateProps } = setup({
      messagingUnavailable: false,
    });

    updateProps({
      messagingUnavailable: true,
    });

    expect(
      screen.getByText(
        /^messaging is unavailable$/i
      )
    ).toBeInTheDocument();
  });

  test("updates when the current user blocks someone", () => {
    const { updateProps } = setup();

    updateProps({
      isBlockedByMe: true,
    });

    expect(
      screen.getByText(
        /you have blocked this user/i
      )
    ).toBeInTheDocument();
  });

  test("shows generic unavailability after unblocking when restrictions remain", () => {
    const { updateProps } = setup({
      isBlockedByMe: true,
    });

    updateProps({
      isBlockedByMe: false,
      messagingUnavailable: true,
    });

    expect(
      screen.getByText(
        /^messaging is unavailable$/i
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        /you have blocked this user/i
      )
    ).not.toBeInTheDocument();
  });

  test("returns to loading while permissions are being checked", () => {
    const { updateProps } = setup();

    updateProps({
      messagingUnavailable: false,
    });

    expect(
      screen.getByText(/checking|loading/i)
    ).toBeInTheDocument();
  });

  test("prioritizes permission loading over stale block status", () => {
    setup({
      isBlockedByMe: true,
      messagingUnavailable: false,
    });

    expect(
      screen.getByText(/checking|loading/i)
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        /you have blocked this user/i
      )
    ).not.toBeInTheDocument();
  });
});

/* -------------------- COMPOSER RESTRICTIONS -------------------- */

describe("Composer restrictions", () => {
  test.each([
    {
      isBlockedByMe: false,
      messagingUnavailable: false,
    },
    {
      isBlockedByMe: true,
      messagingUnavailable: true,
    },
    {
      isBlockedByMe: false,
      messagingUnavailable: true,
    },
    {
      isBlockedByMe: true,
      messagingUnavailable: false,
    },
  ])("does not render interactive composer controls: %p", (props) => {
    const { container } = setup(props);

    expect(
      container.querySelector(
        "input, textarea, select, [contenteditable='true']"
      )
    ).toBeNull();

    expect(
      screen.queryByRole("button")
    ).not.toBeInTheDocument();
  });

  test("can be safely unmounted", () => {
    const { unmount } = setup();

    expect(() => {
      unmount();
    }).not.toThrow();
  });
});