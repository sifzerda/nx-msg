// src/lib/extras/attachments.js

import { createClient } from "@/lib/supabase/client";

import {
  ATTACHMENT_BUCKET,
  MAX_IMAGE_SIZE,
  SIGNED_URL_EXPIRY,
} from "@/constants/attachments";

import {
  validateFile,
  normalizeFile,
} from "@/utils/fileUtils";

const supabase = createClient();

const MAX_CACHE_SIZE = 300;

export const ATTACHMENT_EXPIRY_BUFFER = 60_000;

const urlCache = new Map();
const pendingRequests = new Map();

let cacheGeneration = 0;

/* -------------------- HELPERS -------------------- */

function getStorage() {
  return supabase.storage.from(ATTACHMENT_BUCKET);
}

function getCacheKey(path, userId) {
  return `${userId}:${path}`;
}

function isFresh(entry) {
  return (
    entry &&
    entry.expiresAt >
    Date.now() + ATTACHMENT_EXPIRY_BUFFER
  );
}

function cacheEntry(key, entry) {
  const now = Date.now();

  // Remove expired entries.
  for (const [id, cached] of urlCache) {
    if (cached.expiresAt <= now) {
      urlCache.delete(id);
    }
  }

  // Move updated entries to the end.
  urlCache.delete(key);
  urlCache.set(key, entry);

  // Evict least recently used entries.
  while (urlCache.size > MAX_CACHE_SIZE) {
    urlCache.delete(
      urlCache.keys().next().value
    );
  }
}

/* -------------------- UPLOAD -------------------- */

export async function uploadAttachment({
  conversationId,
  userId,
  file,
}) {
  if (!conversationId || !userId || !file) {
    throw new Error("Missing attachment information");
  }

  const info = validateFile(file);

  const {
    extension,
    mimeType,
    isImage,
  } = info;

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    throw new Error("Image exceeds the 5 MB limit");
  }

const normalizedFile = normalizeFile(file, info);

  const path = `${conversationId}/${userId}/` + `${crypto.randomUUID()}.${extension}`;

  const { error } = await getStorage().upload(
    path,
    normalizedFile,
    {
      contentType: mimeType,
      cacheControl: "300",
      upsert: false,
    }
  );

  if (error) throw error;

  return {
    path,
    type: isImage ? "image" : "file",
    name: file.name.slice(0, 255),
    size: file.size,
    mimeType,
  };
}

/* -------------------- SIGNED URLS -------------------- */

export async function getAttachmentUrl(path, userId) {
  if (!path || !userId) {
    throw new Error("Missing attachment information");
  }

  const key = getCacheKey(path, userId);

  const cached = urlCache.get(key);

  if (isFresh(cached)) {
    // Mark as recently used.
    urlCache.delete(key);
    urlCache.set(key, cached);

    return cached;
  }

  urlCache.delete(key);

  const pending = pendingRequests.get(key);

  if (pending) {
    return pending;
  }

  const generation = cacheGeneration;

  const request = Promise.resolve()
    .then(async () => {
      const startedAt = Date.now();

      const { data, error } =
        await getStorage().createSignedUrl(
          path,
          SIGNED_URL_EXPIRY
        );

      if (
        generation !== cacheGeneration ||
        pendingRequests.get(key) !== request
      ) {
        throw new Error(
          "Attachment request invalidated"
        );
      }

      if (error) throw error;

      if (!data?.signedUrl) {
        throw new Error(
          "Unable to retrieve attachment URL"
        );
      }

      const entry = {
        url: data.signedUrl,
        expiresAt:
          startedAt + SIGNED_URL_EXPIRY * 1000,
      };

      cacheEntry(key, entry);

      return entry;
    })
    .finally(() => {
      if (pendingRequests.get(key) === request) {
        pendingRequests.delete(key);
      }
    });

  pendingRequests.set(key, request);

  return request;
}

/* -------------------- CACHE MANAGEMENT -------------------- */

export function invalidateAttachmentUrl(path, userId) {
  const key = getCacheKey(path, userId);

  urlCache.delete(key);
  pendingRequests.delete(key);
}

export function clearAttachmentCache() {
  cacheGeneration++;

  urlCache.clear();
  pendingRequests.clear();
}

/* -------------------- DOWNLOAD -------------------- */

export async function downloadAttachment(path, name) {
  if (!path) {
    throw new Error("Missing attachment path");
  }

  const { data, error } =
    await getStorage().download(path);

  if (error) throw error;

  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = name || "attachment";

  document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 30_000);
  }
}