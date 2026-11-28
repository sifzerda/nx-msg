// src/app/api/push/unsubscribe/route.js

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function fail(error, status) {
  return json({ error }, status);
}

export async function POST(request) {
  try {
    if (
      request.headers.get("origin") !==
      new URL(request.url).origin
    ) {
      return fail("Invalid origin", 403);
    }

    const body = await request
      .json()
      .catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return fail("Invalid JSON body", 400);
    }

    const endpoint = body.endpoint ?? null;

    const rememberPreference =
      body.rememberPreference === true;

    if (
      endpoint !== null &&
      (
        typeof endpoint !== "string" ||
        !endpoint ||
        endpoint.length > 4096
      )
    ) {
      return fail("Invalid endpoint", 400);
    }

    if (!endpoint && !rememberPreference) {
      return fail("Endpoint is required", 400);
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return fail("Unauthorized", 401);
    }

    const admin = createAdminClient();

    const { data, error } = await admin.rpc(
      "unregister_push_subscription",
      {
        target_user_id: user.id,

        subscription_endpoint: endpoint,

        remember_preference: rememberPreference,
      }
    );

    if (error) throw error;

    if (data === "profile_not_found") {
      return fail("Profile not found", 404);
    }

    if (data !== "success") {
      throw new Error(
        "Unexpected unsubscribe result"
      );
    }

    return json({ success: true });
  } catch (error) {
    console.error("[Push] Unsubscribe failed:", {
      message: error?.message,
      code: error?.code,
    });

    return fail(
      "Could not remove push subscription",
      500
    );
  }
}