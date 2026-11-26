// src/constants/attachments.js

export const ATTACHMENT_BUCKET = "chat-attachments";
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_SOURCE_IMAGE_SIZE = 30 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 1920;
export const IMAGE_QUALITY = 0.85;
export const SIGNED_URL_EXPIRY = 3600;

export const ALLOWED_IMAGE_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const IMAGE_EXTENSIONS = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

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

export const ALLOWED_FILE_EXTENSIONS = Object.freeze(Object.keys(FILE_TYPES));

export const FILE_ACCEPT = ALLOWED_FILE_EXTENSIONS
  .map((extension) => `.${extension}`)
  .join(",");