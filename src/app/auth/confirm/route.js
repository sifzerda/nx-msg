// src/app/auth/confirm/route.js

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");

  const tokenHash =
    url.searchParams.get("token_hash");

  const type = url.searchParams.get("type");

  const failure = () =>
    NextResponse.redirect(
      new URL(
        "/forgot-password?error=invalid_recovery",
        url.origin
      ),
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      }
    );

  if (!code && !(tokenHash && type === "recovery")) {
    return failure();
  }

  try {
    const supabase = await createClient();

    const { data, error } =
      tokenHash && type === "recovery"
        ? await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          })
        : await supabase.auth.exchangeCodeForSession(
            code
          );

    if (
      error ||
      !data.session ||
      !data.user
    ) {
      return failure();
    }

    return NextResponse.redirect(
      new URL("/reset-password", url.origin),
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      }
    );
  } catch {
    return failure();
  }
}