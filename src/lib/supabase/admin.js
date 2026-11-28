// src/lib/supabase/admin.js

import "server-only";

import { createClient } from "@supabase/supabase-js";

let adminClient = null;

export function createAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin environment variables"
    );
  }

  adminClient = createClient(
    url,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );

  return adminClient;
}