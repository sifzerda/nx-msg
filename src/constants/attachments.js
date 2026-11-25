// src/constants/attachments.js

export const ATTACHMENT_BUCKET = "chat-attachments";
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
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