// src/lib/supabase/proxy.js

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          if (!cookiesToSet.length) return;

          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          const updatedResponse =
            NextResponse.next({ request });

          // Preserve any cookies already written during
          // this session refresh operation.
          for (const cookie of response.cookies.getAll()) {
            updatedResponse.cookies.set(cookie);
          }

          for (const {
            name,
            value,
            options,
          } of cookiesToSet) {
            updatedResponse.cookies.set(
              name,
              value,
              options
            );
          }

          response = updatedResponse;
        },
      },
    }
  );

  await supabase.auth.getClaims();

  return response;
}