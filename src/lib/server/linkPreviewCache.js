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
  PREVIEW_RATE_LIMIT,
  PREVIEW_RATE_WINDOW,
} from "@/constants/linkPreviews";

const CACHE_COLUMNS =
  "url,final_url,title,description,image_url,site_name,status,fetched_at,expires_at";

const MAX_PENDING_LOOKUPS =
  MAX_PENDING_REQUESTS * 3;

const QUALITY_TTL = Object.freeze({
  [PREVIEW_QUALITY.COMPLETE]: SUCCESS_CACHE_TTL,
  [PREVIEW_QUALITY.PARTIAL]: PARTIAL_CACHE_TTL,
  [PREVIEW_QUALITY.BASIC]: BASIC_CACHE_TTL,
  [PREVIEW_QUALITY.FAILED]: FAILED_CACHE_TTL,
});

const memoryCache = new Map();
const pendingRequests = new Map();
const pendingCacheLookups = new Map();

let cacheGeneration = 0;

/* -------------------- ERRORS -------------------- */

export class PreviewBusyError extends Error {
  constructor() {
    super("Link preview service is busy");
    this.name = "PreviewBusyError";
  }
}

/* -------------------- URL VALIDATION -------------------- */

function requireUrl(value) {
  const url = normalizeUrl(value);

  if (!url) {
    throw new Error("Invalid preview URL");
  }

  return url;
}

/* -------------------- MEMORY CACHE -------------------- */

function getMemoryPreview(url) {
  const entry = memoryCache.get(url);

  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(url);
    return undefined;
  }

  // Refresh LRU position.

  memoryCache.delete(url);
  memoryCache.set(url, entry);

  return entry.preview;
}

function setMemoryPreview(
  url,
  preview,
  generation
) {
  if (
    !preview ||
    generation !== cacheGeneration
  ) {
    return;
  }

  const now = Date.now();

  const persistentExpiry =
    Date.parse(preview.expires_at);

  if (
    !Number.isFinite(persistentExpiry) ||
    persistentExpiry <= now
  ) {
    return;
  }

  memoryCache.delete(url);

  memoryCache.set(url, {
    preview,

    expiresAt: Math.min(
      persistentExpiry,
      now + METADATA_MEMORY_CACHE_TTL
    ),
  });

  while (
    memoryCache.size >
    MAX_METADATA_CACHE_ENTRIES
  ) {
    memoryCache.delete(
      memoryCache.keys().next().value
    );
  }
}

/* -------------------- REQUEST DEDUPLICATION -------------------- */

function runSharedRequest(
  requests,
  key,
  limit,
  operation
) {
  const existing = requests.get(key);

  if (existing) return existing;

  if (requests.size >= limit) {
    return Promise.reject(
      new PreviewBusyError()
    );
  }

  const request = Promise.resolve()
    .then(operation)
    .finally(() => {
      if (requests.get(key) === request) {
        requests.delete(key);
      }
    });

  requests.set(key, request);

  return request;
}

/* -------------------- DATABASE CACHE -------------------- */

async function getDatabasePreview(
  admin,
  url,
  generation
) {
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
      "Unable to retrieve cached link preview",
      { cause: error }
    );
  }

  if (data) {
    setMemoryPreview(
      url,
      data,
      generation
    );
  }

  return data ?? null;
}

function lookupPreview(admin, url) {
  const cached = getMemoryPreview(url);

  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  const generation = cacheGeneration;

  return runSharedRequest(
    pendingCacheLookups,
    url,
    MAX_PENDING_LOOKUPS,
    () => getDatabasePreview(
      admin,
      url,
      generation
    )
  );
}

export async function getCachedPreview(
  admin,
  value
) {
  return lookupPreview(
    admin,
    requireUrl(value)
  );
}

/* -------------------- CACHE WRITE -------------------- */

async function savePreview(
  admin,
  preview,
  generation
) {
  const { error } = await admin
    .from("link_previews")
    .upsert(preview, {
      onConflict: "url",
    });

  if (error) {
    throw new Error(
      "Unable to cache link preview",
      { cause: error }
    );
  }

  setMemoryPreview(
    preview.url,
    preview,
    generation
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

/* -------------------- GENERATION -------------------- */

async function fetchAndCachePreview(
  admin,
  url,
  cacheChecked,
  generation
) {
  if (!cacheChecked) {
    const cached = await lookupPreview(
      admin,
      url
    );

    if (cached) return cached;
  }

  const cached = getMemoryPreview(url);

  if (cached !== undefined) {
    return cached;
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
          name: error?.name,
          code:
            error?.cause?.code ??
            error?.code,
        }
      );
    }
  }

  return savePreview(
    admin,
    createCacheRecord(
      url,
      metadata,
      status
    ),
    generation
  );
}

export async function generateLinkPreview(
  admin,
  value,
  { cacheChecked = false } = {}
) {
  const url = requireUrl(value);

  const cached = getMemoryPreview(url);

  if (cached !== undefined) {
    return cached;
  }

  const generation = cacheGeneration;

  return runSharedRequest(
    pendingRequests,
    url,
    MAX_PENDING_REQUESTS,
    () => fetchAndCachePreview(
      admin,
      url,
      cacheChecked,
      generation
    )
  );
}

/* -------------------- RATE LIMITING -------------------- */

export async function consumePreviewQuota(
  admin,
  userId
) {
  const { data, error } = await admin.rpc(
    "consume_link_preview_quota",
    {
      target_user_id: userId,
      max_requests: PREVIEW_RATE_LIMIT,
      window_seconds: PREVIEW_RATE_WINDOW,
    }
  );

  if (error) {
    throw new Error(
      "Unable to verify link preview quota",
      { cause: error }
    );
  }

  return data === true;
}

/* -------------------- CACHE MANAGEMENT -------------------- */

function invalidateMemoryPreview(value) {
  const url = normalizeUrl(value);

  if (!url) return;

  cacheGeneration++;

  memoryCache.delete(url);
}

function clearPreviewMemoryCache() {
  cacheGeneration++;

  memoryCache.clear();
}

/* -------------------- SERIALIZATION -------------------- */

export function serializePreview(preview) {
  if (!preview) return null;

  return {
    url: preview.url,

    finalUrl: preview.final_url,

    title: preview.title,

    description: preview.description,

    imageUrl: preview.image_url,

    siteName: preview.site_name,

    status: preview.status,

    quality:
      preview.status === "failed"
        ? PREVIEW_QUALITY.FAILED
        : getMetadataQuality(preview),

    expiresAt: preview.expires_at,
  };
}