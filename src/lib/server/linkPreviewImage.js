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
    IMAGE_CACHE_TTL,
    FAILED_IMAGE_CACHE_TTL,
    MAX_IMAGE_CACHE_ENTRIES,
    MAX_FAILED_IMAGE_CACHE_ENTRIES,
    MAX_IMAGE_CACHE_BYTES,
    MAX_PENDING_IMAGE_REQUESTS,
} from "@/constants/linkPreviews";

/* -------------------- CONSTANTS -------------------- */

const ALLOWED_FORMATS = new Set([
    "jpeg",
    "png",
    "webp",
    "gif",
]);

/* -------------------- CACHE STATE -------------------- */

const imageCache = new Map();

const failedImageCache = new Map();

const pendingRequests = new Map();

let cachedBytes = 0;

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

function pruneImageCache() {
    const now = Date.now();

    for (const [key, entry] of imageCache) {
        if (entry.expiresAt <= now) {
            removeCacheEntry(key);
        }
    }

    while (
        imageCache.size > MAX_IMAGE_CACHE_ENTRIES ||
        cachedBytes > MAX_IMAGE_CACHE_BYTES
    ) {
        const oldestKey =
            imageCache.keys().next().value;

        if (oldestKey === undefined) break;

        removeCacheEntry(oldestKey);
    }
}

function getCachedImage(key) {
    const entry = imageCache.get(key);

    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
        removeCacheEntry(key);

        return null;
    }

    // Refresh LRU order.

    imageCache.delete(key);
    imageCache.set(key, entry);

    return entry.buffer;
}

function cacheImage(key, buffer) {
    removeCacheEntry(key);

    failedImageCache.delete(key);

    if (
        buffer.byteLength >
        MAX_IMAGE_CACHE_BYTES
    ) {
        return;
    }

    imageCache.set(key, {
        buffer,
        expiresAt: Date.now() + IMAGE_CACHE_TTL,
    });

    cachedBytes += buffer.byteLength;

    pruneImageCache();
}

/* -------------------- NEGATIVE CACHE -------------------- */

function pruneFailedImageCache() {
    const now = Date.now();

    for (const [key, expiresAt] of failedImageCache) {
        if (expiresAt <= now) {
            failedImageCache.delete(key);
        }
    }

    while (
        failedImageCache.size >
        MAX_FAILED_IMAGE_CACHE_ENTRIES
    ) {
        const oldestKey =
            failedImageCache.keys().next().value;

        if (oldestKey === undefined) break;

        failedImageCache.delete(oldestKey);
    }
}

function hasCachedFailure(key) {
    const expiresAt = failedImageCache.get(key);

    if (expiresAt === undefined) {
        return false;
    }

    if (expiresAt <= Date.now()) {
        failedImageCache.delete(key);

        return false;
    }

    return true;
}

function cacheFailure(key) {
    failedImageCache.delete(key);

    failedImageCache.set(
        key,
        Date.now() + FAILED_IMAGE_CACHE_TTL
    );

    pruneFailedImageCache();
}

/* -------------------- IMAGE PROCESSING -------------------- */

async function processImage(
    sourceBuffer,
    contentType
) {
    // Reject unsupported or disguised files
    // before passing them to Sharp.
    const detectedFormat = validateImageSignature(
        sourceBuffer,
        contentType
    );

    const image = sharp(sourceBuffer, {
        animated: false,
        pages: 1,
        limitInputPixels: MAX_IMAGE_PIXELS,
        failOn: "error",
    });

    const metadata = await image.metadata();

    if (
        !ALLOWED_FORMATS.has(metadata.format) ||
        metadata.format !== detectedFormat
    ) {
        throw new Error("Invalid image format");
    }

    const { width, height } = metadata;

    if (
        !Number.isSafeInteger(width) ||
        !Number.isSafeInteger(height) ||
        width <= 0 ||
        height <= 0 ||
        width * height > MAX_IMAGE_PIXELS
    ) {
        throw new Error("Invalid image dimensions");
    }

    return image
        .rotate()
        .resize({
            width: PREVIEW_IMAGE_WIDTH,
            height: PREVIEW_IMAGE_HEIGHT,
            fit: "inside",
            withoutEnlargement: true,
        })
        .webp({
            quality: PREVIEW_IMAGE_QUALITY,
            effort: 3,
        })
        .timeout({
            seconds: 5,
        })
        .toBuffer();
}

/* -------------------- FETCH AND PROCESS -------------------- */

async function fetchAndProcessImage(url) {
    try {
        const { buffer, contentType } = await safeFetchImage(url);
        const thumbnail = await processImage(buffer, contentType);

        cacheImage(url, thumbnail);

        return thumbnail;
    } catch (error) {
        cacheFailure(url);

        if (process.env.NODE_ENV === "development") {
            console.error(
                "[LinkPreviewImage] Extraction failed",
                {
                    hostname: new URL(url).hostname,
                    name: error.name,
                    message: error.message,
                    code: error.cause?.code ?? error.code,
                }
            );
        }

        throw new ImagePreviewUnavailableError();
    }
}

/* -------------------- PUBLIC IMAGE SERVICE -------------------- */

export async function getPreviewImage(value) {
    const url = normalizeUrl(value);

    if (
        !url ||
        new URL(url).protocol !== "https:"
    ) {
        throw new ImagePreviewUnavailableError();
    }

    // Check successful cache.

    const cached = getCachedImage(url);

    if (cached) {
        return cached;
    }

    // Check unsuccessful cache.

    if (hasCachedFailure(url)) {
        throw new ImagePreviewUnavailableError();
    }

    // Reuse existing requests.

    const existing = pendingRequests.get(url);

    if (existing) {
        return existing;
    }

    // Limit simultaneous image processing.

    if (
        pendingRequests.size >=
        MAX_PENDING_IMAGE_REQUESTS
    ) {
        throw new ImagePreviewBusyError();
    }

    const promise = fetchAndProcessImage(url)
        .finally(() => {
            if (pendingRequests.get(url) === promise) {
                pendingRequests.delete(url);
            }
        });

    pendingRequests.set(url, promise);

    return promise;
}

/* -------------------- CACHE MANAGEMENT -------------------- */

export function invalidatePreviewImage(value) {
    const url = normalizeUrl(value);

    if (!url) return;

    removeCacheEntry(url);

    failedImageCache.delete(url);
}

export function clearPreviewImageCache() {
    imageCache.clear();

    failedImageCache.clear();

    cachedBytes = 0;
}

/* -------------------- DIAGNOSTICS -------------------- */

export function getPreviewImageCacheStats() {
    pruneImageCache();

    pruneFailedImageCache();

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