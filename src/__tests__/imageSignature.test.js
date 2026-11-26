// src/__tests__/imageSignature.test.js

import {
  describe,
  test,
  expect,
} from "@jest/globals";

import {
  detectImageFormat,
  validateImageSignature,
} from "@/lib/server/imageSignature";

/* -------------------- TEST FIXTURES -------------------- */

const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0,
]);

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
]);

const GIF87 = Buffer.from("GIF87a");
const GIF89 = Buffer.from("GIF89a");

function createWebP() {
  const buffer = Buffer.alloc(24);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(16, 4);
  buffer.write("WEBP", 8);
  buffer.write("VP8 ", 12);
  buffer.writeUInt32LE(4, 16);

  return buffer;
}

const WEBP = createWebP();

/* -------------------- VALID SIGNATURES -------------------- */

describe("Image signature detection", () => {
  test.each([
    [JPEG, "jpeg"],
    [PNG, "png"],
    [GIF87, "gif"],
    [GIF89, "gif"],
    [WEBP, "webp"],
  ])("detects supported image format %s", (
    buffer,
    format
  ) => {
    expect(
      detectImageFormat(buffer)
    ).toBe(format);
  });
});

/* -------------------- UNSUPPORTED CONTENT -------------------- */

describe("Unsupported image content", () => {
  test.each([
    Buffer.from("<html>Hello</html>"),

    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"/>'
    ),

    Buffer.from(
      '<?xml version="1.0"?><svg/>'
    ),

    Buffer.from("%PDF-1.7"),

    Buffer.from("GIF90a"),

    Buffer.from("RIFF"),

    Buffer.from([0xff, 0xd8]),

    Buffer.from([0x89, 0x50]),

    Buffer.alloc(0),

    null,

    undefined,

    "not a buffer",
  ])("rejects unsupported input %s", (input) => {
    expect(
      detectImageFormat(input)
    ).toBeNull();
  });
});

/* -------------------- MIME VALIDATION -------------------- */

describe("Image content type validation", () => {
  test.each([
    [JPEG, "image/jpeg", "jpeg"],
    [PNG, "image/png", "png"],
    [GIF87, "image/gif", "gif"],
    [GIF89, "image/gif", "gif"],
    [WEBP, "image/webp", "webp"],
  ])("accepts matching content type", (
    buffer,
    contentType,
    format
  ) => {
    expect(
      validateImageSignature(
        buffer,
        contentType
      )
    ).toBe(format);
  });

  test("rejects mismatched JPEG content type", () => {
    expect(() =>
      validateImageSignature(
        JPEG,
        "image/png"
      )
    ).toThrow("Image content type mismatch");
  });

  test("rejects mismatched PNG content type", () => {
    expect(() =>
      validateImageSignature(
        PNG,
        "image/jpeg"
      )
    ).toThrow("Image content type mismatch");
  });

  test("rejects missing content type", () => {
    expect(() =>
      validateImageSignature(PNG, null)
    ).toThrow("Image content type mismatch");
  });

  test("normalises content type", () => {
    expect(
      validateImageSignature(
        PNG,
        "IMAGE/PNG; charset=utf-8"
      )
    ).toBe("png");
  });

  test("rejects SVG disguised as PNG", () => {
    expect(() =>
      validateImageSignature(
        Buffer.from("<svg/>"),
        "image/png"
      )
    ).toThrow("Unsupported image signature");
  });

  test("rejects HTML disguised as JPEG", () => {
    expect(() =>
      validateImageSignature(
        Buffer.from("<html/>"),
        "image/jpeg"
      )
    ).toThrow("Unsupported image signature");
  });
});

/* -------------------- WEBP VALIDATION -------------------- */

describe("WebP container validation", () => {
  test("rejects incorrect RIFF size", () => {
    const buffer = createWebP();

    buffer.writeUInt32LE(9999, 4);

    expect(
      detectImageFormat(buffer)
    ).toBeNull();
  });

  test("rejects unsupported chunk type", () => {
    const buffer = createWebP();

    buffer.write("FAKE", 12);

    expect(
      detectImageFormat(buffer)
    ).toBeNull();
  });

  test("rejects oversized chunk declaration", () => {
    const buffer = createWebP();

    buffer.writeUInt32LE(9999, 16);

    expect(
      detectImageFormat(buffer)
    ).toBeNull();
  });

  test("rejects empty image chunk", () => {
    const buffer = createWebP();

    buffer.writeUInt32LE(0, 16);

    expect(
      detectImageFormat(buffer)
    ).toBeNull();
  });

  test("rejects truncated WebP container", () => {
    const buffer = createWebP();

    expect(
      detectImageFormat(
        buffer.subarray(0, 16)
      )
    ).toBeNull();
  });
});