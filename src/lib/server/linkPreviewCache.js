// src/lib/server/linkPreviewCache.js

import "server-only";

import { extractMetadata } from "./extractMetadata";

import { normalizeUrl } from "@/utils/urlUtils";

import {
  SUCCESS_CACHE_TTL,
  FAILED_CACHE_TTL,
  MAX_PENDING_REQUESTS,
} from "@/constants/linkPreviews";

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

const pendingRequests = new Map();

/* -------------------- ERRORS -------------------- */

export class PreviewBusyError extends Error {
  constructor() {
    super("Link preview service is busy");

    this.name = "PreviewBusyError";
  }
}

/* -------------------- CACHE LOOKUP -------------------- */

export async function getCachedPreview(
  admin,
  value
) {
  const url = normalizeUrl(value);

  if (!url) {
    throw new Error("Invalid preview URL");
  }

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

  return data ?? null;
}

/* -------------------- CACHE WRITE -------------------- */

async function savePreview(
  admin,
  preview
) {
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

  return preview;
}

/* -------------------- CACHE RECORD -------------------- */

function createCacheRecord(
  url,
  metadata,
  status
) {
  const fetchedAt = Date.now();

  const ttl =
    status === "success"
      ? SUCCESS_CACHE_TTL
      : FAILED_CACHE_TTL;

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
  url
) {
  // Recheck the persistent cache in case another
  // request populated it in the meantime.

  const cached = await getCachedPreview(
    admin,
    url
  );

  if (cached) {
    return cached;
  }

  let metadata = null;
  let status = "success";

try {
  metadata = await extractMetadata(url);
} catch (error) {
  status = "failed";

  if (process.env.NODE_ENV === "development") {
    console.error("[LinkPreview] Extraction failed", {
      hostname: new URL(url).hostname,
      name: error.name,
      message: error.message,
      cause: error.cause?.message,
      code: error.cause?.code ?? error.code,
    });
  }
}

  const preview = createCacheRecord(
    url,
    metadata,
    status
  );

  return savePreview(admin, preview);
}

/* -------------------- REQUEST DEDUPLICATION -------------------- */

export function generateLinkPreview(
  admin,
  value
) {
  const url = normalizeUrl(value);

  if (!url) {
    return Promise.reject(
      new Error("Invalid preview URL")
    );
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
    url
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

/* -------------------- PUBLIC RESPONSE -------------------- */

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
    expiresAt: preview.expires_at,
  };
}