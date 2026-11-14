// src/lib/messageProfiles.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const profileCache = new Map();

export async function getMessageProfiles(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];

  const missing = ids.filter((id) => !profileCache.has(id));

  if (missing.length) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", missing);

    if (error) throw error;

    for (const profile of data ?? []) {
      profileCache.set(profile.id, profile);
    }
  }

  return Object.fromEntries(
    ids.map((id) => [id, profileCache.get(id) ?? null])
  );
}

export function clearMessageProfileCache() {
  profileCache.clear();
}
