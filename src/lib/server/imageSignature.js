// src/lib/server/imageSignature.js

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
]);

const JPEG_SIGNATURE = Buffer.from([ 0xff, 0xd8, 0xff ]);

const GIF87_SIGNATURE = Buffer.from("GIF87a");
const GIF89_SIGNATURE = Buffer.from("GIF89a");

const RIFF_SIGNATURE = Buffer.from("RIFF");
const WEBP_SIGNATURE = Buffer.from("WEBP");

const WEBP_CHUNK_TYPES = new Set([
  "VP8 ",
  "VP8L",
  "VP8X",
]);

const FORMAT_CONTENT_TYPES = Object.freeze({
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
});

/* -------------------- SIGNATURE MATCHING -------------------- */

function matchesSignature(
  buffer,
  signature,
  offset = 0
) {
  if (
    buffer.length < offset + signature.length
  ) {
    return false;
  }

  return buffer
    .subarray(offset, offset + signature.length)
    .equals(signature);
}

/* -------------------- WEBP VALIDATION -------------------- */

function isWebP(buffer) {
  if (buffer.length < 20) {
    return false;
  }

  if (
    !matchesSignature(buffer, RIFF_SIGNATURE) ||
    !matchesSignature(buffer, WEBP_SIGNATURE, 8)
  ) {
    return false;
  }

  const declaredSize = buffer.readUInt32LE(4);

  if (
    declaredSize + 8 !== buffer.length
  ) {
    return false;
  }

  const chunkType = buffer.toString("ascii", 12, 16);

  if (!WEBP_CHUNK_TYPES.has(chunkType)) {
    return false;
  }

  const chunkSize = buffer.readUInt32LE(16);
  const paddedSize = chunkSize + (chunkSize % 2);

  return (chunkSize > 0 && 20 + paddedSize <= buffer.length);
}

/* -------------------- FORMAT DETECTION -------------------- */

export function detectImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return null;
  }

  if (
    matchesSignature(buffer, PNG_SIGNATURE)
  ) {
    return "png";
  }

  if (
    matchesSignature(buffer, JPEG_SIGNATURE)
  ) {
    return "jpeg";
  }

  if (
    matchesSignature(buffer, GIF87_SIGNATURE) ||
    matchesSignature(buffer, GIF89_SIGNATURE)
  ) {
    return "gif";
  }

  if (isWebP(buffer)) {
    return "webp";
  }

  return null;
}

/* -------------------- IMAGE VALIDATION -------------------- */

export function validateImageSignature(
  buffer,
  contentType
) {
  const format = detectImageFormat(buffer);

  if (!format) {
    throw new Error(
      "Unsupported image signature"
    );
  }

  const normalizedContentType =
    typeof contentType === "string"
      ? contentType
          .split(";")[0]
          .trim()
          .toLowerCase()
      : "";

  if (
    FORMAT_CONTENT_TYPES[format] !==
    normalizedContentType
  ) {
    throw new Error(
      "Image content type mismatch"
    );
  }

  return format;
}