// src/lib/extras/linkPreviews.js

const MAX_CACHE_ENTRIES = 300;
const MAX_IMAGE_CACHE_ENTRIES = 100;
const MAX_IMAGE_CACHE_BYTES = 8 * 1024 * 1024;

const MAX_CONCURRENT_REQUESTS = 3;
const MAX_QUEUED_REQUESTS = 100;

const CACHE_TTL = 30 * 60 * 1000;
const FAILED_IMAGE_TTL = 60 * 1000;
const REQUEST_TIMEOUT = 25000;

const DEFAULT_COOLDOWN = 60_000;
const MAX_COOLDOWN = 5 * 60_000;

let cooldownUntil = 0;
/* -------------------- STATE -------------------- */

const metadataCache = new Map();
const imageCache = new Map();
const pendingRequests = new Map();
const requestQueue = [];

let activeRequests = 0;
let imageCacheBytes = 0;
let generation = 0;

/* -------------------- CACHE HELPERS -------------------- */

function getCacheKey(userId, messageId) {
  return `${userId}:${messageId}`;
}

function getCached(cache, key, remove) {
  const entry = cache.get(key);

  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    remove(key);
    return undefined;
  }

  // Refresh LRU order.
  cache.delete(key);
  cache.set(key, entry);

  return entry.value;
}

function getExpiry(serverExpiry, ttl = CACHE_TTL) {
  const now = Date.now();
  const parsed = Date.parse(serverExpiry);

  return Number.isFinite(parsed)
    ? Math.min(parsed, now + ttl)
    : now + ttl;
}

function removeMetadata(key) {
  metadataCache.delete(key);
}

function removeImage(key) {
  const entry = imageCache.get(key);

  if (!entry) return;

  imageCacheBytes -= entry.value?.size ?? 0;

  imageCache.delete(key);
}

function trimCache(cache, maxEntries, remove) {
  while (cache.size > maxEntries) {
    remove(cache.keys().next().value);
  }
}

/* -------------------- METADATA CACHE -------------------- */

export function getCachedLinkPreview(userId, messageId) {
  if (!userId || !messageId) {
    return undefined;
  }

  return getCached(
    metadataCache,
    getCacheKey(userId, messageId),
    removeMetadata
  );
}

function cacheMetadata(key, preview) {
  const expiresAt = getExpiry(preview?.expiresAt);

  if (expiresAt <= Date.now()) return;

  metadataCache.delete(key);

  metadataCache.set(key, {
    value: preview,
    expiresAt,
  });

  trimCache(
    metadataCache,
    MAX_CACHE_ENTRIES,
    removeMetadata
  );
}

/* -------------------- IMAGE CACHE -------------------- */

function cacheImage(key, blob, serverExpiry) {
  removeImage(key);

  const size = blob?.size ?? 0;

  if (size > MAX_IMAGE_CACHE_BYTES) {
    return;
  }

  const expiresAt = getExpiry(
    serverExpiry,
    blob ? CACHE_TTL : FAILED_IMAGE_TTL
  );

  if (expiresAt <= Date.now()) return;

  imageCache.set(key, {
    value: blob,
    expiresAt,
  });

  imageCacheBytes += size;

  while (
    imageCache.size > MAX_IMAGE_CACHE_ENTRIES ||
    imageCacheBytes > MAX_IMAGE_CACHE_BYTES
  ) {
    removeImage(imageCache.keys().next().value);
  }
}

function getImageKey(userId, messageId, imageUrl) {
  return `${getCacheKey(userId, messageId)}:${imageUrl}`;
}

export function getCachedPreviewImage(
  userId,
  messageId,
  imageUrl
) {
  if (!userId || !messageId || !imageUrl) {
    return undefined;
  }

  return getCached(
    imageCache,
    getImageKey(userId, messageId, imageUrl),
    removeImage
  );
}

/* -------------------- REQUEST QUEUE -------------------- */

function processQueue() {
  while (
    activeRequests < MAX_CONCURRENT_REQUESTS &&
    requestQueue.length
  ) {
    const task = requestQueue.shift();

    activeRequests++;

    Promise.resolve()
      .then(task.run)
      .then(task.resolve, task.reject)
      .finally(() => {
        activeRequests--;
        processQueue();
      });
  }
}

function enqueueRequest(run) {
  if (requestQueue.length >= MAX_QUEUED_REQUESTS) {
    return Promise.reject(
      new Error("Link preview queue is full")
    );
  }

  return new Promise((resolve, reject) => {
    requestQueue.push({
      run,
      resolve,
      reject,
    });

    processQueue();
  });
}

/* -------------------- REQUEST MANAGEMENT -------------------- */

function createAbortError() {
  return new DOMException(
    "Preview request cancelled",
    "AbortError"
  );
}

function runRequest(key, execute, onSuccess) {
  const existing = pendingRequests.get(key);

  if (existing) {
    return existing.promise;
  }

  const requestGeneration = generation;
  const controller = new AbortController();

  const promise = enqueueRequest(async () => {
    if (
      requestGeneration !== generation ||
      controller.signal.aborted
    ) {
      throw createAbortError();
    }

    let timedOut = false;
    
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT);

    try {
      const result = await execute(controller.signal);

      if (
        requestGeneration !== generation ||
        controller.signal.aborted
      ) {
        throw createAbortError();
      }

      onSuccess(result);

      return result;
    } catch (error) {
      if (requestGeneration !== generation) {
        throw createAbortError();
      }

      if (timedOut) {
        throw new Error("Link preview request timed out");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }).finally(() => {
    if (pendingRequests.get(key)?.promise === promise) {
      pendingRequests.delete(key);
    }
  });

  pendingRequests.set(key, {
    promise,
    controller,
  });

  return promise;
}

/* -------------------- RESPONSE VALIDATION -------------------- */

function validateResponse(response) {
  if (response.status === 429) {
    const delay = getRetryDelay(
      response,
      DEFAULT_COOLDOWN
    );

    cooldownUntil = Math.max(
      cooldownUntil,
      Date.now() + delay
    );

    throw new Error(
      "Link preview rate limit reached. Try again shortly."
    );
  }

  if (response.status === 503) {
    throw new Error(
      "Link preview service is busy. Try again shortly."
    );
  }

  if (!response.ok) {
    throw new Error(
      `Unable to load link preview (${response.status})`
    );
  }
}

/* -------------------- METADATA REQUEST -------------------- */

async function requestMetadata(messageId, signal) {
  const response = await fetch("/api/link-preview", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    credentials: "same-origin",
    cache: "no-store",
    signal,

    body: JSON.stringify({
      messageId,
    }),
  });

  validateResponse(response);

  const data = await response.json();

  return data.preview ?? null;
}

export function getLinkPreview(userId, messageId) {
  if (!userId || !messageId) {
    return Promise.resolve(null);
  }

  const cached = getCachedLinkPreview(userId, messageId);

  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  const key = getCacheKey(userId, messageId);

  return runRequest(
    `metadata:${key}`,
    (signal) => requestMetadata(messageId, signal),
    (preview) => cacheMetadata(key, preview)
  );
}

/* -------------------- IMAGE REQUEST -------------------- */

async function requestImage(messageId, signal) {
  const response = await fetch(
    `/api/link-preview/image?messageId=${encodeURIComponent(messageId)}`,
    {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }
  );

  if (response.status === 404) {
    return null;
  }

  validateResponse(response);

  const contentType = response.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (contentType !== "image/webp") {
    throw new Error("Invalid preview image");
  }

  const blob = await response.blob();

  if (!blob.size || blob.size > MAX_IMAGE_CACHE_BYTES) {
    throw new Error("Invalid preview image size");
  }

  return blob;
}

export function getLinkPreviewImage(
  userId,
  messageId,
  imageUrl,
  expiresAt
) {
  if (!userId || !messageId || !imageUrl) {
    return Promise.resolve(null);
  }

  const cached = getCachedPreviewImage(
    userId,
    messageId,
    imageUrl
  );

  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  const key = getImageKey(
    userId,
    messageId,
    imageUrl
  );

  return runRequest(
    `image:${key}`,
    (signal) => requestImage(messageId, signal),
    (blob) => cacheImage(key, blob, expiresAt)
  );
}

/* -------------------- INVALIDATION -------------------- */

export function invalidateLinkPreview(userId, messageId) {
  const key = getCacheKey(userId, messageId);

  removeMetadata(key);

  for (const imageKey of imageCache.keys()) {
    if (imageKey.startsWith(`${key}:`)) {
      removeImage(imageKey);
    }
  }
}

export function clearLinkPreviewCache() {
  generation++;

  metadataCache.clear();
  imageCache.clear();

  imageCacheBytes = 0;

  for (const request of pendingRequests.values()) {
    request.controller.abort();
  }

  pendingRequests.clear();

  for (const task of requestQueue.splice(0)) {
    task.reject(createAbortError());
  }
}

/* -------------------- DIAGNOSTICS -------------------- */

export function getLinkPreviewCacheStats() {
  return {
    metadataEntries: metadataCache.size,
    imageEntries: imageCache.size,
    imageCacheBytes,
    pendingRequests: pendingRequests.size,
    activeRequests,
    queuedRequests: requestQueue.length,
  };
}

/*-------------------- HELPERS -------------------- */

function getRetryDelay(response, fallback) {
  const value = response.headers.get("retry-after");

  if (!value) return fallback;

  const seconds = Number(value);

  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - Date.now();

  return Number.isFinite(delay)
    ? Math.min(
        MAX_COOLDOWN,
        Math.max(1000, delay)
      )
    : fallback;
}

function assertRequestAllowed() {
  if (Date.now() < cooldownUntil) {
    throw new Error(
      "Link preview rate limit reached. Try again shortly."
    );
  }
}