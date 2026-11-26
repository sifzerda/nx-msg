// src/lib/extras/attachments.js

import { createClient } from "@/lib/supabase/client";

import {
  ATTACHMENT_BUCKET,
  MAX_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES,
  IMAGE_EXTENSIONS,
  SIGNED_URL_EXPIRY,
} from "@/constants/attachments";

const supabase = createClient();

const urlCache = new Map();
const pendingRequests = new Map();

const MAX_CACHE_SIZE = 300;
const EXPIRY_BUFFER = 60 * 1000;

let cacheGeneration = 0;

export async function uploadImage({
  conversationId,
  userId,
  file,
}) {
  if (!conversationId || !userId || !file) {
    throw new Error("Missing attachment information");
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Unsupported image format");
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Image exceeds the 5 MB limit");
  }

  const extension = IMAGE_EXTENSIONS[file.type];

  const path =
    `${conversationId}/${userId}/` +
    `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "300",
      upsert: false,
    });

  if (error) throw error;

  return {
    path,
    type: "image",
    name: file.name.slice(0, 255),
  };
}

function pruneCache() {
  const now = Date.now();

  for (const [key, entry] of urlCache) {
    if (entry.expiresAt <= now) {
      urlCache.delete(key);
    }
  }

  while (urlCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = urlCache.keys().next().value;
    urlCache.delete(oldestKey);
  }
}

export async function getAttachmentUrl(path, userId) {
  if (!path || !userId) {
    throw new Error("Missing attachment information");
  }

  const key = `${userId}:${path}`;
  const cached = urlCache.get(key);

  if (
    cached &&
    cached.expiresAt > Date.now() + EXPIRY_BUFFER
  ) {
    return cached;
  }

  const pending = pendingRequests.get(key);

  if (pending) {
    return pending;
  }

  const generation = cacheGeneration;

  const request = (async () => {
    const { data, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY);

    if (error) throw error;

    const entry = {
      url: data.signedUrl,
      expiresAt:
        Date.now() + SIGNED_URL_EXPIRY * 1000,
    };

    if (generation === cacheGeneration) {
      pruneCache();
      urlCache.set(key, entry);
    }

    return entry;
  })();

  pendingRequests.set(key, request);

  try {
    return await request;
  } finally {
    if (pendingRequests.get(key) === request) {
      pendingRequests.delete(key);
    }
  }
}

export function invalidateAttachmentUrl(path, userId) {
  urlCache.delete(`${userId}:${path}`);
}

export function clearAttachmentCache() {
  cacheGeneration += 1;

  urlCache.clear();
  pendingRequests.clear();
}
