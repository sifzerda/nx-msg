// src/utils/__tests__/urlUtils.test.js

import {
  describe,
  test,
  expect,
} from "@jest/globals";

import {
  normalizeUrl,
  extractUrls,
  splitMessageText,
  getUrlHostname,
} from "@/utils/urlUtils";

describe("normalizeUrl", () => {
  test("normalizes a standard URL", () => {
    expect(
      normalizeUrl("https://example.com")
    ).toBe("https://example.com/");
  });

  test("supports www URLs", () => {
    expect(
      normalizeUrl("www.example.com")
    ).toBe("https://www.example.com/");
  });

  test("removes fragments", () => {
    expect(
      normalizeUrl(
        "https://example.com/article#section"
      )
    ).toBe("https://example.com/article");
  });

  test("preserves query parameters", () => {
    expect(
      normalizeUrl(
        "https://example.com/?page=2"
      )
    ).toBe("https://example.com/?page=2");
  });

  test("rejects javascript URLs", () => {
    expect(
      normalizeUrl("javascript:alert(1)")
    ).toBeNull();
  });

  test("rejects file URLs", () => {
    expect(
      normalizeUrl("file:///example.txt")
    ).toBeNull();
  });

  test("rejects URLs containing credentials", () => {
    expect(
      normalizeUrl(
        "https://user:password@example.com"
      )
    ).toBeNull();
  });

  test("rejects invalid input", () => {
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("hello")).toBeNull();
  });

  test("rejects oversized URLs", () => {
    expect(
      normalizeUrl(
        `https://example.com/${"a".repeat(3000)}`
      )
    ).toBeNull();
  });
});

describe("extractUrls", () => {
  test("extracts a URL from message text", () => {
    expect(
      extractUrls(
        "Check out https://example.com!"
      )
    ).toEqual([
      "https://example.com/",
    ]);
  });

  test("removes trailing punctuation", () => {
    expect(
      extractUrls(
        "Visit https://example.com/article."
      )
    ).toEqual([
      "https://example.com/article",
    ]);
  });

  test("removes surrounding parentheses", () => {
    expect(
      extractUrls(
        "(https://example.com/article)"
      )
    ).toEqual([
      "https://example.com/article",
    ]);
  });

  test("preserves balanced URL parentheses", () => {
    expect(
      extractUrls(
        "https://example.com/Article_(music)"
      )
    ).toEqual([
      "https://example.com/Article_(music)",
    ]);
  });

  test("removes duplicate URLs", () => {
    expect(
      extractUrls(
        "https://example.com https://example.com",
        5
      )
    ).toEqual([
      "https://example.com/",
    ]);
  });

  test("limits previews to one by default", () => {
    expect(
      extractUrls(
        "https://example.com https://example.org"
      )
    ).toEqual([
      "https://example.com/",
    ]);
  });

  test("supports a custom preview limit", () => {
    expect(
      extractUrls(
        "https://example.com https://example.org",
        2
      )
    ).toEqual([
      "https://example.com/",
      "https://example.org/",
    ]);
  });

  test("returns no URLs for ordinary text", () => {
    expect(
      extractUrls("Hello there!")
    ).toEqual([]);
  });
});

describe("splitMessageText", () => {
  test("separates text and clickable links", () => {
    expect(
      splitMessageText(
        "Visit https://example.com today"
      )
    ).toEqual([
      {
        type: "text",
        value: "Visit ",
      },
      {
        type: "link",
        value: "https://example.com",
        url: "https://example.com/",
      },
      {
        type: "text",
        value: " today",
      },
    ]);
  });

  test("preserves trailing punctuation", () => {
    const parts = splitMessageText(
      "Visit https://example.com!"
    );

    expect(
      parts.map((part) => part.value).join("")
    ).toBe(
      "Visit https://example.com!"
    );
  });

  test("preserves ordinary text", () => {
    expect(
      splitMessageText("Hello")
    ).toEqual([
      {
        type: "text",
        value: "Hello",
      },
    ]);
  });

  test("handles empty messages", () => {
    expect(splitMessageText("")).toEqual([]);
  });
});

describe("getUrlHostname", () => {
  test("extracts a hostname", () => {
    expect(
      getUrlHostname(
        "https://www.example.com/article"
      )
    ).toBe("example.com");
  });

  test("handles invalid URLs", () => {
    expect(
      getUrlHostname("invalid")
    ).toBe("");
  });
});