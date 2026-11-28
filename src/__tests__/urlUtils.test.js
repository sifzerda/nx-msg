// src/__tests__/urlUtils.test.js

import {
  describe,
  test,
  expect,
} from "@jest/globals";

import {
  normalizeUrl,
  splitMessageText,
  getUrlHostname,
} from "@/utils/urlUtils";

/* -------------------- NORMALISATION -------------------- */

describe("normalizeUrl", () => {
  test.each([
    [
      "https://example.com",
      "https://example.com/",
    ],
    [
      "www.example.com",
      "https://www.example.com/",
    ],
    [
      "https://example.com/article#section",
      "https://example.com/article",
    ],
    [
      "https://example.com/?page=2",
      "https://example.com/?page=2",
    ],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  test.each([
    "javascript:alert(1)",
    "file:///example.txt",
    "https://user:password@example.com",
    null,
    undefined,
    "",
    "hello",
  ])("rejects invalid URL %p", (input) => {
    expect(normalizeUrl(input)).toBeNull();
  });

  test("rejects oversized URLs", () => {
    expect(
      normalizeUrl(
        `https://example.com/${"a".repeat(3000)}`
      )
    ).toBeNull();
  });
});

/* -------------------- MESSAGE LINKS -------------------- */

describe("splitMessageText", () => {
  function getLinks(text) {
    return splitMessageText(text)
      .filter((part) => part.type === "link")
      .map((part) => part.url);
  }

  test.each([
    [
      "Check out https://example.com!",
      ["https://example.com/"],
    ],
    [
      "Visit https://example.com/article.",
      ["https://example.com/article"],
    ],
    [
      "(https://example.com/article)",
      ["https://example.com/article"],
    ],
    [
      "https://example.com/Article_(music)",
      ["https://example.com/Article_(music)"],
    ],
    [
      "Visit www.example.com",
      ["https://www.example.com/"],
    ],
    [
      "https://example.com https://example.org",
      [
        "https://example.com/",
        "https://example.org/",
      ],
    ],
    [
      "https://example.com https://example.com",
      [
        "https://example.com/",
        "https://example.com/",
      ],
    ],
    [
      "https://example.com/article#section",
      ["https://example.com/article#section"],
    ],
    [
      "Hello there!",
      [],
    ],
    [
      "https://user:password@example.com",
      [],
    ],
  ])("extracts links from %s", (text, expected) => {
    expect(getLinks(text)).toEqual(expected);
  });

  test.each([
    "Visit https://example.com!",
    "(https://example.com/article)",
    "https://example.com/Article_(music)",
    "https://example.com https://example.org",
    "Hello there!",
  ])("preserves original message text: %s", (text) => {
    expect(
      splitMessageText(text)
        .map((part) => part.value)
        .join("")
    ).toBe(text);
  });

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

  test("preserves ordinary text", () => {
    expect(splitMessageText("Hello")).toEqual([
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

/* -------------------- HOSTNAME -------------------- */

describe("getUrlHostname", () => {
  test("extracts a hostname", () => {
    expect(
      getUrlHostname(
        "https://www.example.com/article"
      )
    ).toBe("example.com");
  });

  test("handles invalid URLs", () => {
    expect(getUrlHostname("invalid")).toBe("");
  });
});