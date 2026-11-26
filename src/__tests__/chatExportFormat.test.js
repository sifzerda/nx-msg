// src/utils/__tests__/chatExportFormat.test.js

import {
  describe,
  test,
  expect,
} from "@jest/globals";

import {
  formatExportMessage,
  formatExportReply,
  safeExportFilename,
  formatExportDate,
} from "@/utils/chatExportFormat";

describe("formatExportMessage", () => {
  test("formats text messages", () => {
    expect(
      formatExportMessage({
        content: "Hello there",
      })
    ).toBe("Hello there");
  });

  test("formats GIF-only messages", () => {
    expect(
      formatExportMessage({
        content: "",
        gif_id: "abc123",
      })
    ).toBe(
      "[GIF]\r\nGIPHY ID: abc123"
    );
  });

  test("formats GIF captions", () => {
    expect(
      formatExportMessage({
        gif_id: "abc123",
        content: "Funny!",
      })
    ).toBe(
      "[GIF]\r\nGIPHY ID: abc123\r\nFunny!"
    );
  });

  test("formats image messages", () => {
    expect(
      formatExportMessage({
        attachment_type: "image",
        attachment_name: "photo.webp",
      })
    ).toBe("[Image: photo.webp]");
  });

  test("formats file messages", () => {
    expect(
      formatExportMessage({
        attachment_type: "file",
        attachment_name: "report.pdf",
      })
    ).toBe("[File: report.pdf]");
  });

  test("includes attachment metadata", () => {
    const result = formatExportMessage({
      attachment_path: "private/path",
      attachment_type: "file",
      attachment_name: "report.pdf",
      attachment_size: 1024,
      attachment_mime_type: "application/pdf",
    });

    expect(result).toContain(
      "[File: report.pdf]"
    );

    expect(result).toContain("Size:");

    expect(result).toContain(
      "Type: application/pdf"
    );

    expect(result).not.toContain(
      "private/path"
    );
  });

  test("handles empty messages", () => {
    expect(
      formatExportMessage({
        content: "",
      })
    ).toBe("[Empty message]");
  });
});

describe("formatExportReply", () => {
  test("formats reply references", () => {
    const messages = new Map([
      [
        "message-1",
        {
          id: "message-1",
          sender_id: "user-1",
          content: "Hello",
        },
      ],
    ]);

    const profiles = new Map([
      ["user-1", "Alex"],
    ]);

    expect(
      formatExportReply(
        { reply_to_id: "message-1" },
        messages,
        profiles
      )
    ).toBe("> Reply to Alex: Hello");
  });

  test("handles unavailable replies", () => {
    expect(
      formatExportReply(
        { reply_to_id: "missing" },
        new Map(),
        new Map()
      )
    ).toBe(
      "> Reply to an unavailable message"
    );
  });

  test("ignores messages without replies", () => {
    expect(
      formatExportReply(
        {},
        new Map(),
        new Map()
      )
    ).toBeNull();
  });
});

describe("safeExportFilename", () => {
  test("removes invalid filename characters", () => {
    expect(
      safeExportFilename("Alex: Chat/History")
    ).toBe("Alex_ Chat_History");
  });

  test("provides a fallback filename", () => {
    expect(
      safeExportFilename("")
    ).toBe("conversation");
  });

  test("limits filename length", () => {
    expect(
      safeExportFilename("a".repeat(200))
        .length
    ).toBe(80);
  });
});

describe("formatExportDate", () => {
  test("handles invalid dates", () => {
    expect(
      formatExportDate("invalid")
    ).toBe("Unknown date");
  });
});