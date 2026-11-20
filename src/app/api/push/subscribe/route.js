// src/app/api/push/subscribe/route.js

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function fail(message, status) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return fail("Unauthorized", 401);
    }

    if (
      request.headers.get("origin") !==
      new URL(request.url).origin
    ) {
      return fail("Invalid origin", 403);
    }

    const body = await request.json();

    const subscription = body.subscription ?? body;
    const rememberPreference =
      body.rememberPreference === true;

    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (
      typeof endpoint !== "string" ||
      !endpoint ||
      endpoint.length > 4096 ||
      typeof p256dh !== "string" ||
      !p256dh ||
      p256dh.length > 256 ||
      typeof auth !== "string" ||
      !auth ||
      auth.length > 256
    ) {
      return fail("Invalid subscription", 400);
    }

    let url;

    try {
      url = new URL(endpoint);
    } catch {
      return fail("Invalid endpoint", 400);
    }

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port
    ) {
      return fail("Invalid endpoint", 400);
    }

    const admin = createAdminClient();

    // Automatic restoration is only allowed if
    // the user previously enabled notifications.
    if (!rememberPreference) {
      const { data: profile, error } = await admin
        .from("profiles")
        .select("notifications_enabled")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (!profile.notifications_enabled) {
        return fail("Notifications are disabled", 403);
      }
    }

    // Never silently transfer another user's
    // push endpoint to the current account.
    const { data: existing, error: lookupError } =
      await admin
        .from("push_subscriptions")
        .select("user_id")
        .eq("endpoint", endpoint)
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (existing && existing.user_id !== user.id) {
      return fail(
        "This push subscription belongs to another account",
        409
      );
    }

    const { error: subscriptionError } = await admin
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth_key: auth,
        },
        { onConflict: "endpoint" }
      );

    if (subscriptionError) throw subscriptionError;

    if (rememberPreference) {
      const { error: preferenceError } = await admin
        .from("profiles")
        .update({ notifications_enabled: true })
        .eq("id", user.id);

      if (preferenceError) throw preferenceError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Push] Subscription failed:", {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });

    return fail(
      process.env.NODE_ENV === "development"
        ? error?.message || "Could not save subscription"
        : "Could not save subscription",
      500
    );
  }
}
