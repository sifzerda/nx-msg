// src/utils/__tests__/emojiUtils.test.js

import {
  describe,
  test,
  expect,
} from "@jest/globals";
import { insertEmoji } from "@/utils/messageUtils";

describe("insertEmoji", () => {
  test("inserts an emoji into an empty message", () => {
    expect(
      insertEmoji("", "😊", 0, 0)
    ).toEqual({
      text: "😊",
      cursor: 2,
      inserted: true,
    });
  });

  test("appends an emoji to a message", () => {
    expect(
      insertEmoji("Hello", "😊", 5, 5)
    ).toEqual({
      text: "Hello😊",
      cursor: 7,
      inserted: true,
    });
  });

  test("inserts an emoji at the beginning", () => {
    expect(
      insertEmoji("Hello", "😊", 0, 0)
    ).toEqual({
      text: "😊Hello",
      cursor: 2,
      inserted: true,
    });
  });

  test("inserts an emoji in the middle", () => {
    expect(
      insertEmoji("Hello world", "😊", 6, 6)
    ).toEqual({
      text: "Hello 😊world",
      cursor: 8,
      inserted: true,
    });
  });

  test("replaces selected text", () => {
    expect(
      insertEmoji("Hello world", "😊", 6, 11)
    ).toEqual({
      text: "Hello 😊",
      cursor: 8,
      inserted: true,
    });
  });

  test("supports emojis with skin tones", () => {
    const emoji = "👍🏽";

    expect(
      insertEmoji("Hi ", emoji, 3, 3)
    ).toEqual({
      text: `Hi ${emoji}`,
      cursor: 3 + emoji.length,
      inserted: true,
    });
  });

  test("supports combined family emojis", () => {
    const emoji = "👨‍👩‍👧‍👦";

    expect(
      insertEmoji("", emoji, 0, 0)
    ).toEqual({
      text: emoji,
      cursor: emoji.length,
      inserted: true,
    });
  });

  test("rejects insertion exceeding maximum length", () => {
    expect(
      insertEmoji("Hello", "😊", 5, 5, 6)
    ).toEqual({
      text: "Hello",
      cursor: 5,
      inserted: false,
    });
  });

  test("allows insertion when replacing enough text", () => {
    expect(
      insertEmoji("Hello", "😊", 0, 5, 5)
    ).toEqual({
      text: "😊",
      cursor: 2,
      inserted: true,
    });
  });

  test("rejects an empty emoji", () => {
    expect(
      insertEmoji("Hello", "", 5, 5)
    ).toEqual({
      text: "Hello",
      cursor: 5,
      inserted: false,
    });
  });

  test("clamps an invalid cursor position", () => {
    expect(
      insertEmoji("Hello", "😊", 100, 100)
    ).toEqual({
      text: "Hello😊",
      cursor: 7,
      inserted: true,
    });
  });

  test("defaults to the end of the message", () => {
    expect(
      insertEmoji("Hello", "😊")
    ).toEqual({
      text: "Hello😊",
      cursor: 7,
      inserted: true,
    });
  });
});