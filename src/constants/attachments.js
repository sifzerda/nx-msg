// src/constants/attachments.js

export const ATTACHMENT_BUCKET = "chat-attachments";

const MB = 1024 * 1024;
const KB = 1024;

/* -------------------- FILE LIMITS -------------------- */

export const MAX_IMAGE_SIZE = 5 * MB;
export const MAX_FILE_SIZE = 20 * MB;
export const MAX_SOURCE_IMAGE_SIZE = 30 * MB;

/* -------------------- IMAGE COMPRESSION -------------------- */

export const TARGET_IMAGE_SIZE = 500 * KB;

export const MAX_IMAGE_DIMENSION = 1920;

export const IMAGE_QUALITY = 0.85;
export const MIN_IMAGE_QUALITY = 0.55;
export const IMAGE_QUALITY_STEP = 0.1;

/* -------------------- SIGNED URLS -------------------- */

export const SIGNED_URL_EXPIRY = 3600;

/* -------------------- IMAGE FORMATS -------------------- */

export const IMAGE_EXTENSIONS = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

export const ALLOWED_IMAGE_TYPES = Object.freeze(
  Object.keys(IMAGE_EXTENSIONS)
);

/* -------------------- FILE FORMATS -------------------- */

export const FILE_TYPES = Object.freeze({
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",

  pdf: "application/pdf",

  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",

  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  txt: "text/plain",
  json: "application/json",

  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",

  zip: "application/zip",
});

export const FILE_ACCEPT = Object.keys(FILE_TYPES)
  .map((extension) => `.${extension}`)
  .join(",");