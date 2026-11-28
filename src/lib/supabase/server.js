// src/lib/supabase/server.js

import "server-only";

import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/* -------------------- SERVER CLIENT -------------------- */

export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            for (const {
              name,
              value,
              options,
            } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies.
            // The proxy handles session refresh.
          }
        },
      },
    }
  );
});

/* -------------------- AUTHENTICATION -------------------- */

export const getAuthUser = cache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return error ? null : user ?? null;
});

/* -------------------- PROTECTED ROUTES -------------------- */

export async function requireUser() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/* -------------------- DISPLAY PROFILE -------------------- */

export const getCurrentUser = cache(async () => {
  const user = await getAuthUser();

  if (!user) return null;

  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error(
      "[Auth] Profile retrieval failed:",
      error.message
    );
  }

  return {
    id: user.id,
    username: profile?.username ?? "",
    display_name: profile?.display_name ?? "User",
  };
});