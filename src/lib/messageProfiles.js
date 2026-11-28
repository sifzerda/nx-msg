// src/lib/messageProfiles.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const CACHE_TTL = 5 * 60 * 1000;
const MISSING_TTL = 30 * 1000;

const MAX_CACHE_SIZE = 1000;
const BATCH_SIZE = 100;

const PROFILE_COLUMNS = "id, username, display_name";

const profileCache = new Map();
const pendingRequests = new Map();

let queuedProfiles = new Map();
let batchScheduled = false;
let generation = 0;

/* -------------------- CACHE -------------------- */

function getCachedProfile(id) {
  const entry = profileCache.get(id);

  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    profileCache.delete(id);
    return undefined;
  }

  // Move recently accessed profiles to the end.
  profileCache.delete(id);
  profileCache.set(id, entry);

  return entry.profile;
}

function cacheProfile(id, profile, now) {
  profileCache.delete(id);

  profileCache.set(id, {
    profile,
    expiresAt:
      now + (profile ? CACHE_TTL : MISSING_TTL),
  });

  while (profileCache.size > MAX_CACHE_SIZE) {
    const oldest = profileCache.keys().next().value;

    profileCache.delete(oldest);
  }
}

/* -------------------- PROFILE RETRIEVAL -------------------- */

async function fetchBatch(entries, currentGeneration) {
  const ids = entries.map(([id]) => id);

  try {
    if (currentGeneration !== generation) {
      for (const [, request] of entries) {
        request.resolve(null);
      }

      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .in("id", ids);

    if (error) throw error;

    const profiles = new Map(
      (data ?? []).map((profile) => [
        profile.id,
        profile,
      ])
    );

    const isCurrent =
      currentGeneration === generation;

    const now = Date.now();

    for (const [id, request] of entries) {
      const profile = isCurrent
        ? profiles.get(id) ?? null
        : null;

      if (isCurrent) {
        cacheProfile(id, profile, now);
      }

      request.resolve(profile);
    }
  } catch (error) {
    for (const [, request] of entries) {
      if (currentGeneration === generation) {
        request.reject(error);
      } else {
        request.resolve(null);
      }
    }
  } finally {
    for (const [id, request] of entries) {
      if (pendingRequests.get(id) === request.promise) {
        pendingRequests.delete(id);
      }
    }
  }
}

/* -------------------- REQUEST BATCHING -------------------- */

async function flushQueue(currentGeneration) {
  if (currentGeneration !== generation) return;

  batchScheduled = false;

  const entries = [...queuedProfiles];

  queuedProfiles.clear();

  // Process bounded batches sequentially.
  for (
    let offset = 0;
    offset < entries.length;
    offset += BATCH_SIZE
  ) {
    await fetchBatch(
      entries.slice(offset, offset + BATCH_SIZE),
      currentGeneration
    );
  }
}

function scheduleBatch() {
  if (batchScheduled) return;

  batchScheduled = true;

  const currentGeneration = generation;

  queueMicrotask(() => {
    void flushQueue(currentGeneration);
  });
}

function requestProfile(id) {
  const cached = getCachedProfile(id);

  // null represents a cached missing profile.
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  const pending = pendingRequests.get(id);

  if (pending) return pending;

  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  pendingRequests.set(id, promise);

  queuedProfiles.set(id, {
    promise,
    resolve,
    reject,
  });

  scheduleBatch();

  return promise;
}

/* -------------------- PUBLIC INTERFACE -------------------- */

export async function getMessageProfiles(userIds) {
  const currentGeneration = generation;

  const ids = [
    ...new Set(userIds.filter(Boolean)),
  ];

  if (!ids.length) return {};

  const profiles = await Promise.all(
    ids.map(requestProfile)
  );

  if (currentGeneration !== generation) {
    return {};
  }

  return Object.fromEntries(
    ids.map((id, index) => [
      id,
      profiles[index],
    ])
  );
}

export function clearMessageProfileCache() {
  generation++;

  // Settle requests that have not started yet.
  for (const request of queuedProfiles.values()) {
    request.resolve(null);
  }

  queuedProfiles = new Map();
  batchScheduled = false;

  profileCache.clear();
  pendingRequests.clear();
}