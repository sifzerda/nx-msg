// src/lib/server/linkPreviewImage.js

import "server-only";

import sharp from "sharp";

import { safeFetchImage } from "./safeFetch";
import { validateImageSignature } from "./imageSignature";
import { normalizeUrl } from "@/utils/urlUtils";

import {
  MAX_IMAGE_PIXELS,
  PREVIEW_IMAGE_WIDTH,
  PREVIEW_IMAGE_HEIGHT,
  PREVIEW_IMAGE_QUALITY,
  PREVIEW_IMAGE_EFFORT,
  IMAGE_PROCESSING_TIMEOUT,
  IMAGE_CACHE_TTL,
  FAILED_IMAGE_CACHE_TTL,
  MAX_IMAGE_CACHE_ENTRIES,
  MAX_FAILED_IMAGE_CACHE_ENTRIES,
  MAX_IMAGE_CACHE_BYTES,
  MAX_PENDING_IMAGE_REQUESTS,
} from "@/constants/linkPreviews";

const imageCache = new Map();
const failedImageCache = new Map();
const pendingRequests = new Map();

let cachedBytes = 0;
let cacheGeneration = 0;

/* -------------------- ERRORS -------------------- */

export class ImagePreviewBusyError extends Error {
  constructor() {
    super("Image preview service is busy");
    this.name = "ImagePreviewBusyError";
  }
}

export class ImagePreviewUnavailableError extends Error {
  constructor() {
    super("Preview image unavailable");
    this.name = "ImagePreviewUnavailableError";
  }
}

/* -------------------- SUCCESS CACHE -------------------- */

function removeCacheEntry(key) {
  const entry = imageCache.get(key);

  if (!entry) return;

  cachedBytes -= entry.buffer.byteLength;

  imageCache.delete(key);
}

function getCachedImage(key) {
  const entry = imageCache.get(key);

  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    removeCacheEntry(key);
    return null;
  }

  // Refresh LRU position.

  imageCache.delete(key);
  imageCache.set(key, entry);

  return entry.buffer;
}

function cacheImage(
  key,
  buffer,
  generation
) {
  if (generation !== cacheGeneration) {
    return;
  }

  removeCacheEntry(key);
  failedImageCache.delete(key);

  const size = buffer.byteLength;

  if (size > MAX_IMAGE_CACHE_BYTES) {
    return;
  }

  imageCache.set(key, {
    buffer,
    expiresAt: Date.now() + IMAGE_CACHE_TTL,
  });

  cachedBytes += size;

  while (
    imageCache.size > MAX_IMAGE_CACHE_ENTRIES ||
    cachedBytes > MAX_IMAGE_CACHE_BYTES
  ) {
    removeCacheEntry(
      imageCache.keys().next().value
    );
  }
}

/* -------------------- NEGATIVE CACHE -------------------- */

function hasCachedFailure(key) {
  const expiresAt =
    failedImageCache.get(key);

  if (expiresAt === undefined) {
    return false;
  }

  if (expiresAt <= Date.now()) {
    failedImageCache.delete(key);
    return false;
  }

  // Refresh LRU position without extending TTL.

  failedImageCache.delete(key);
  failedImageCache.set(key, expiresAt);

  return true;
}

function cacheFailure(key, generation) {
  if (generation !== cacheGeneration) {
    return;
  }

  removeCacheEntry(key);

  failedImageCache.delete(key);

  failedImageCache.set(
    key,
    Date.now() + FAILED_IMAGE_CACHE_TTL
  );

  while (
    failedImageCache.size >
    MAX_FAILED_IMAGE_CACHE_ENTRIES
  ) {
    failedImageCache.delete(
      failedImageCache.keys().next().value
    );
  }
}

/* -------------------- IMAGE PROCESSING -------------------- */

async function processImage(sourceBuffer, contentType) {
  const detectedFormat = validateImageSignature(
    sourceBuffer,
    contentType
  );

  const image = sharp(sourceBuffer, {
    animated: false,
    pages: 1,
    limitInputPixels: MAX_IMAGE_PIXELS,
    failOn: "error",
    sequentialRead: true,
  });

  const { format, width, height } =
    await image.metadata();

  if (
    format !== detectedFormat ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new Error("Invalid preview image");
  }

  return image
    .rotate()
    .resize({
      width: PREVIEW_IMAGE_WIDTH,
      height: PREVIEW_IMAGE_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
      fastShrinkOnLoad: true,
    })
    .webp({
      quality: PREVIEW_IMAGE_QUALITY,
      effort: PREVIEW_IMAGE_EFFORT,
    })
    .timeout({
      seconds: IMAGE_PROCESSING_TIMEOUT,
    })
    .toBuffer();
}

/* -------------------- FETCH AND PROCESS -------------------- */

async function fetchAndProcessImage(
  url,
  generation
) {
  try {
    const { buffer, contentType } =
      await safeFetchImage(url);

    const thumbnail =
      await processImage(
        buffer,
        contentType
      );

    cacheImage(
      url,
      thumbnail,
      generation
    );

    return thumbnail;
  } catch (error) {
    cacheFailure(url, generation);

    if (
      process.env.NODE_ENV === "development"
    ) {
      console.error(
        "[LinkPreviewImage] Extraction failed",
        {
          hostname: new URL(url).hostname,
          name: error?.name,
          message: error?.message,
          code:
            error?.cause?.code ??
            error?.code,
        }
      );
    }

    throw new ImagePreviewUnavailableError();
  }
}

/* -------------------- PUBLIC SERVICE -------------------- */

export async function getPreviewImage(value) {
  const url = normalizeUrl(value);

  if (
    !url ||
    new URL(url).protocol !== "https:"
  ) {
    throw new ImagePreviewUnavailableError();
  }

  const cached = getCachedImage(url);

  if (cached) return cached;

  if (hasCachedFailure(url)) {
    throw new ImagePreviewUnavailableError();
  }

  const existing = pendingRequests.get(url);

  if (existing) return existing;

  if (
    pendingRequests.size >=
    MAX_PENDING_IMAGE_REQUESTS
  ) {
    throw new ImagePreviewBusyError();
  }

  const generation = cacheGeneration;

  const request = Promise.resolve()
    .then(() => fetchAndProcessImage(
      url,
      generation
    ))
    .finally(() => {
      if (
        pendingRequests.get(url) === request
      ) {
        pendingRequests.delete(url);
      }
    });

  pendingRequests.set(url, request);

  return request;
}

/* -------------------- CACHE MANAGEMENT -------------------- */

export function invalidatePreviewImage(value) {
  const url = normalizeUrl(value);

  if (!url) return;

  cacheGeneration++;

  removeCacheEntry(url);
  failedImageCache.delete(url);
}

export function clearPreviewImageCache() {
  cacheGeneration++;

  imageCache.clear();
  failedImageCache.clear();

  cachedBytes = 0;
}

/* -------------------- DIAGNOSTICS -------------------- */

export function getPreviewImageCacheStats() {
  const now = Date.now();

  for (const [key, entry] of imageCache) {
    if (entry.expiresAt <= now) {
      removeCacheEntry(key);
    }
  }

  for (const [key, expiresAt] of failedImageCache) {
    if (expiresAt <= now) {
      failedImageCache.delete(key);
    }
  }

  return {
    cachedImages: imageCache.size,

    failedImages: failedImageCache.size,

    pendingRequests: pendingRequests.size,

    cachedBytes,

    cachedMegabytes: Number(
      (cachedBytes / (1024 * 1024)).toFixed(2)
    ),
  };
}