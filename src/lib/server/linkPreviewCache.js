// src/lib/server/linkPreviewCache.js

import "server-only";

import {
  extractMetadata,
  getMetadataQuality,
} from "./extractMetadata";

import { normalizeUrl } from "@/utils/urlUtils";

import {
  SUCCESS_CACHE_TTL,
  PARTIAL_CACHE_TTL,
  BASIC_CACHE_TTL,
  FAILED_CACHE_TTL,
  METADATA_MEMORY_CACHE_TTL,
  MAX_METADATA_CACHE_ENTRIES,
  MAX_PENDING_REQUESTS,
  PREVIEW_QUALITY,
} from "@/constants/linkPreviews";

/* -------------------- CONSTANTS -------------------- */

const CACHE_COLUMNS = [
  "url",
  "final_url",
  "title",
  "description",
  "image_url",
  "site_name",
  "status",
  "fetched_at",
  "expires_at",
].join(",");

const QUALITY_TTL = Object.freeze({
  [PREVIEW_QUALITY.COMPLETE]:
    SUCCESS_CACHE_TTL,

  [PREVIEW_QUALITY.PARTIAL]:
    PARTIAL_CACHE_TTL,

  [PREVIEW_QUALITY.BASIC]:
    BASIC_CACHE_TTL,

  [PREVIEW_QUALITY.FAILED]:
    FAILED_CACHE_TTL,
});

/* -------------------- MEMORY STATE -------------------- */

const memoryCache = new Map();

const pendingRequests = new Map();

const pendingCacheLookups = new Map();

/* -------------------- ERRORS -------------------- */

export class PreviewBusyError extends Error {
  constructor() {
    super("Link preview service is busy");

    this.name = "PreviewBusyError";
  }
}

/* -------------------- MEMORY CACHE -------------------- */

function pruneMemoryCache() {
  const now = Date.now();

  for (const [key, entry] of memoryCache) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }

  while (
    memoryCache.size >
    MAX_METADATA_CACHE_ENTRIES
  ) {
    const oldestKey =
      memoryCache.keys().next().value;

    if (oldestKey === undefined) {
      break;
    }

    memoryCache.delete(oldestKey);
  }
}

function getMemoryPreview(url) {
  const entry = memoryCache.get(url);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(url);

    return undefined;
  }

  // Refresh LRU order.

  memoryCache.delete(url);
  memoryCache.set(url, entry);

  return entry.preview;
}

function setMemoryPreview(url, preview) {
  if (!preview) {
    return;
  }

  const now = Date.now();

  const persistentExpiry = Date.parse(
    preview.expires_at
  );

  if (
    !Number.isFinite(persistentExpiry) ||
    persistentExpiry <= now
  ) {
    return;
  }

  const expiresAt = Math.min(
    persistentExpiry,
    now + METADATA_MEMORY_CACHE_TTL
  );

  memoryCache.delete(url);

  memoryCache.set(url, {
    preview,
    expiresAt,
  });

  pruneMemoryCache();
}

/* -------------------- DATABASE LOOKUP -------------------- */

async function getDatabasePreview(admin, url) {
  const { data, error } = await admin
    .from("link_previews")
    .select(CACHE_COLUMNS)
    .eq("url", url)
    .gt(
      "expires_at",
      new Date().toISOString()
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      "Unable to retrieve cached link preview"
    );
  }

  if (data) {
    setMemoryPreview(url, data);
  }

  return data ?? null;
}

/* -------------------- PUBLIC CACHE LOOKUP -------------------- */

export async function getCachedPreview(
  admin,
  value
) {
  const url = normalizeUrl(value);

  if (!url) {
    throw new Error("Invalid preview URL");
  }

  const memoryPreview =
    getMemoryPreview(url);

  if (memoryPreview !== undefined) {
    return memoryPreview;
  }

  const existingLookup =
    pendingCacheLookups.get(url);

  if (existingLookup) {
    return existingLookup;
  }

  // Bound the number of simultaneous database
  // cache lookups tracked in memory.

  if (
    pendingCacheLookups.size >=
    MAX_PENDING_REQUESTS * 3
  ) {
    throw new PreviewBusyError();
  }

  const lookup = getDatabasePreview(
    admin,
    url
  ).finally(() => {
    if (
      pendingCacheLookups.get(url) === lookup
    ) {
      pendingCacheLookups.delete(url);
    }
  });

  pendingCacheLookups.set(url, lookup);

  return lookup;
}

/* -------------------- CACHE WRITE -------------------- */

async function savePreview(admin, preview) {
  const { error } = await admin
    .from("link_previews")
    .upsert(preview, {
      onConflict: "url",
    });

  if (error) {
    throw new Error(
      "Unable to cache link preview"
    );
  }

  setMemoryPreview(
    preview.url,
    preview
  );

  return preview;
}

/* -------------------- CACHE RECORD -------------------- */

function createCacheRecord(
  url,
  metadata,
  status
) {
  const fetchedAt = Date.now();

  const quality =
    status === "failed"
      ? PREVIEW_QUALITY.FAILED
      : getMetadataQuality(metadata);

  const ttl =
    QUALITY_TTL[quality] ??
    FAILED_CACHE_TTL;

  return {
    url,

    final_url:
      metadata?.final_url ?? null,

    title:
      metadata?.title ?? null,

    description:
      metadata?.description ?? null,

    image_url:
      metadata?.image_url ?? null,

    site_name:
      metadata?.site_name ?? null,

    status,

    fetched_at:
      new Date(fetchedAt).toISOString(),

    expires_at:
      new Date(fetchedAt + ttl).toISOString(),
  };
}

/* -------------------- FETCH AND CACHE -------------------- */

async function fetchAndCachePreview(
  admin,
  url,
  cacheChecked
) {
  if (!cacheChecked) {
    const cached = await getCachedPreview(
      admin,
      url
    );

    if (cached) {
      return cached;
    }
  }

  // Another request may have populated the
  // memory cache since the initial lookup.

  const memoryPreview =
    getMemoryPreview(url);

  if (memoryPreview !== undefined) {
    return memoryPreview;
  }

  let metadata = null;

  let status = "success";

  try {
    metadata = await extractMetadata(url);
  } catch (error) {
    status = "failed";

    if (
      process.env.NODE_ENV === "development"
    ) {
      console.error(
        "[LinkPreview] Extraction failed",
        {
          hostname: new URL(url).hostname,
          name: error.name,
          code:
            error.cause?.code ??
            error.code,
        }
      );
    }
  }

  const preview = createCacheRecord(
    url,
    metadata,
    status
  );

  return savePreview(
    admin,
    preview
  );
}

/* -------------------- REQUEST DEDUPLICATION -------------------- */

export function generateLinkPreview(
  admin,
  value,
  {
    cacheChecked = false,
  } = {}
) {
  const url = normalizeUrl(value);

  if (!url) {
    return Promise.reject(
      new Error("Invalid preview URL")
    );
  }

  const memoryPreview =
    getMemoryPreview(url);

  if (memoryPreview !== undefined) {
    return Promise.resolve(memoryPreview);
  }

  const existingRequest =
    pendingRequests.get(url);

  if (existingRequest) {
    return existingRequest;
  }

  if (
    pendingRequests.size >=
    MAX_PENDING_REQUESTS
  ) {
    return Promise.reject(
      new PreviewBusyError()
    );
  }

  const request = fetchAndCachePreview(
    admin,
    url,
    cacheChecked
  ).finally(() => {
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

export function invalidateMemoryPreview(value) {
  const url = normalizeUrl(value);

  if (url) {
    memoryCache.delete(url);
  }
}

export function clearPreviewMemoryCache() {
  memoryCache.clear();
}

/* -------------------- PUBLIC RESPONSE -------------------- */

export function serializePreview(preview) {
  if (!preview) {
    return null;
  }

  const quality =
    preview.status === "failed"
      ? PREVIEW_QUALITY.FAILED
      : getMetadataQuality(preview);

  return {
    url: preview.url,

    finalUrl: preview.final_url,

    title: preview.title,

    description: preview.description,

    imageUrl: preview.image_url,

    siteName: preview.site_name,

    status: preview.status,

    quality,

    expiresAt: preview.expires_at,
  };
}