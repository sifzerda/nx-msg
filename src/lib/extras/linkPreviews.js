// src/lib/extras/linkPreviews.js

const MAX_CACHE_ENTRIES = 300;
const MAX_CONCURRENT_REQUESTS = 3;
const MAX_QUEUED_REQUESTS = 100;
const MAX_CLIENT_CACHE_TTL = 15 * 60 * 1000;

const cache = new Map();
const pendingRequests = new Map();
const requestQueue = [];

let activeRequests = 0;
let generation = 0;

function getCacheKey(userId, messageId) {
  return `${userId}:${messageId}`;
}

function pruneCache() {
  const now = Date.now();

  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }

  while (cache.size > MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

export function getCachedLinkPreview(userId, messageId) {
  if (!userId || !messageId) {
    return undefined;
  }

  const key = getCacheKey(userId, messageId);
  const entry = cache.get(key);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }

  // Refresh insertion order for LRU eviction.
  cache.delete(key);
  cache.set(key, entry);

  return entry.preview;
}

function cachePreview(key, preview) {
  const now = Date.now();

  const serverExpiry = preview?.expiresAt
    ? Date.parse(preview.expiresAt)
    : now + MAX_CLIENT_CACHE_TTL;

  const expiresAt = Math.min(
    Number.isFinite(serverExpiry)
      ? serverExpiry
      : now + MAX_CLIENT_CACHE_TTL,
    now + MAX_CLIENT_CACHE_TTL
  );

  cache.set(key, {
    preview,
    expiresAt,
  });

  pruneCache();
}

function processQueue() {
  while (
    activeRequests < MAX_CONCURRENT_REQUESTS &&
    requestQueue.length > 0
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

async function requestPreview(messageId, signal) {
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

  if (response.status === 429) {
    throw new Error("Link preview rate limit reached");
  }

  if (!response.ok) {
    throw new Error(
      `Unable to load link preview (${response.status})`
    );
  }

  const data = await response.json();

  return data.preview ?? null;
}

export function getLinkPreview(userId, messageId) {
  if (!userId || !messageId) {
    return Promise.resolve(null);
  }

  const cached = getCachedLinkPreview(
    userId,
    messageId
  );

  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  const key = getCacheKey(userId, messageId);

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
      throw new DOMException(
        "Request cancelled",
        "AbortError"
      );
    }

    const timeout = setTimeout(() => {
      controller.abort();
    }, 20000);

    try {
      const preview = await requestPreview(
        messageId,
        controller.signal
      );

      if (requestGeneration !== generation) {
        throw new DOMException(
          "Session changed",
          "AbortError"
        );
      }

      cachePreview(key, preview);

      return preview;
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

export function invalidateLinkPreview(userId, messageId) {
  cache.delete(getCacheKey(userId, messageId));
}

export function clearLinkPreviewCache() {
  generation++;

  cache.clear();

  for (const request of pendingRequests.values()) {
    request.controller.abort();
  }

  pendingRequests.clear();

  for (const task of requestQueue.splice(0)) {
    task.reject(
      new DOMException(
        "Session changed",
        "AbortError"
      )
    );
  }
}