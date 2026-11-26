// src/lib/extras/attachments.js

import { createClient } from "@/lib/supabase/client";
import { ATTACHMENT_BUCKET, MAX_IMAGE_SIZE, SIGNED_URL_EXPIRY } from "@/constants/attachments";
import { validateFile, normalizeFile } from "@/utils/fileUtils";

const supabase = createClient();

const urlCache = new Map();
const pendingRequests = new Map();

const MAX_CACHE_SIZE = 300;
const EXPIRY_BUFFER = 60 * 1000;

let cacheGeneration = 0;

export async function uploadAttachment({
  conversationId,
  userId,
  file,
}) {
  if (!conversationId || !userId || !file) {
    throw new Error("Missing attachment information");
  }

  const {
    extension,
    mimeType,
    isImage,
  } = validateFile(file);

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    throw new Error("Image exceeds the 5 MB limit");
  }

  const normalizedFile = normalizeFile(file);
  const path = `${conversationId}/${userId}/` + `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, normalizedFile, {
      contentType: mimeType,
      cacheControl: "300",
      upsert: false,
    });

  if (error) throw error;

  return {
    path,
    type: isImage ? "image" : "file",
    name: file.name.slice(0, 255),
    size: file.size,
    mimeType,
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
    cached && cached.expiresAt > Date.now() + EXPIRY_BUFFER
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

export async function downloadAttachment(path, name) {
  if (!path) {
    throw new Error("Missing attachment path");
  }

  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .download(path);

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
    }, 30000);
  }
}