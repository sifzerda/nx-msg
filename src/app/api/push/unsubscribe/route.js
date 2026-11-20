// src/app/api/push/unsubscribe/route.js

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function respond(error, status) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return respond("Unauthorized", 401);
    }

    if (
      request.headers.get("origin") !==
      new URL(request.url).origin
    ) {
      return respond("Invalid origin", 403);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return respond("Invalid JSON body", 400);
    }

    const endpoint = body?.endpoint;
    const rememberPreference =
      body?.rememberPreference === true;

    if (
      typeof endpoint !== "string" ||
      !endpoint ||
      endpoint.length > 4096
    ) {
      return respond("Invalid endpoint", 400);
    }

    const admin = createAdminClient();

    // An explicit disable must persist across logins.
    // Do this before deleting the subscription so
    // notification delivery is disabled immediately.
    if (rememberPreference) {
      const { error: preferenceError } = await admin
        .from("profiles")
        .update({ notifications_enabled: false })
        .eq("id", user.id);

      if (preferenceError) {
        console.error(
          "[Push] Preference update failed:",
          preferenceError
        );

        return respond(
          "Could not save notification preference",
          500
        );
      }
    }

    const { error: deleteError } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (deleteError) {
      console.error(
        "[Push] Unsubscribe failed:",
        deleteError
      );

      return respond(
        "Could not remove push subscription",
        500
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[Push] Unexpected unsubscribe error:",
      error
    );

    return respond(
      "Unexpected push unsubscribe error",
      500
    );
  }
}
