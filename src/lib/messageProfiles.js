// src/lib/messageProfiles.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const CACHE_TTL = 5 * 60 * 1000;
const MISSING_TTL = 30 * 1000;
const MAX_CACHE_SIZE = 1000;
const profileCache = new Map();
const pendingRequests = new Map();

let generation = 0;

function pruneCache() {
  const now = Date.now();

  for (const [id, entry] of profileCache) {
    if (entry.expiresAt <= now) {
      profileCache.delete(id);
    }
  }

  while (profileCache.size > MAX_CACHE_SIZE) {
    const oldest = profileCache.keys().next().value;

    profileCache.delete(oldest);
  }
}

function fetchProfiles(ids) {
  const currentGeneration = generation;

  const request = (async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", ids);

    if (error) throw error;

    const profiles = new Map(
      (data ?? []).map((profile) => [
        profile.id,
        profile,
      ])
    );

    if (currentGeneration === generation) {
      const now = Date.now();

      for (const id of ids) {
        const profile = profiles.get(id) ?? null;

        profileCache.set(id, {
          profile,
          expiresAt:
            now + (profile ? CACHE_TTL : MISSING_TTL),
        });
      }

      pruneCache();
    }

    return profiles;
  })();

  for (const id of ids) {
    pendingRequests.set(id, request);
  }

  function cleanup() {
    for (const id of ids) {
      if (pendingRequests.get(id) === request) {
        pendingRequests.delete(id);
      }
    }
  }

  request.then(cleanup, cleanup);

  return request;
}

export async function getMessageProfiles(userIds) {
  const currentGeneration = generation;

  const ids = [...new Set(userIds.filter(Boolean))];

  const results = new Map();
  const missing = [];
  const requests = new Set();

  const now = Date.now();

  for (const id of ids) {
    const cached = profileCache.get(id);

    if (cached && cached.expiresAt > now) {
      results.set(id, cached.profile);
      continue;
    }

    const pending = pendingRequests.get(id);

    if (pending) {
      requests.add(pending);
    } else {
      missing.push(id);
    }
  }

  if (missing.length) {
    requests.add(fetchProfiles(missing));
  }

  const responses = await Promise.all(requests);

  if (currentGeneration !== generation) {
    return {};
  }

  for (const profiles of responses) {
    for (const [id, profile] of profiles) {
      results.set(id, profile);
    }
  }

  return Object.fromEntries(
    ids.map((id) => [
      id,
      results.get(id) ?? null,
    ])
  );
}

export function clearMessageProfileCache() {
  generation++;

  profileCache.clear();
  pendingRequests.clear();
}
