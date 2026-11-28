// src/app/api/push/subscribe/route.js

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPushEndpoint } from "@/lib/webPush";

export const runtime = "nodejs";

const KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

const RESULT_ERRORS = {
  profile_not_found: {
    message: "Profile not found",
    status: 404,
  },

  notifications_disabled: {
    message: "Notifications are disabled",
    status: 403,
  },

  endpoint_conflict: {
    message:
      "This push subscription belongs to another account",
    status: 409,
  },
};

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

function isValidKey(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    KEY_PATTERN.test(value)
  );
}

export async function POST(request) {
  try {
    /* Reject cross-origin requests before authentication. */

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

    const subscription =
      body.subscription ?? body;

    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!isValidPushEndpoint(endpoint)) {
      return fail(
        "Invalid or unsupported push endpoint",
        400
      );
    }

    if (!isValidKey(p256dh) || !isValidKey(auth)) {
      return fail("Invalid subscription keys", 400);
    }

    /* Authenticate the current account. */

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return fail("Unauthorized", 401);
    }

    /* Execute registration in one database transaction. */

    const admin = createAdminClient();

    const { data, error } = await admin.rpc(
      "register_push_subscription",
      {
        target_user_id: user.id,

        subscription_endpoint: endpoint,

        subscription_p256dh: p256dh,

        subscription_auth_key: auth,

        remember_preference:
          body.rememberPreference === true,
      }
    );

    if (error) throw error;

    if (data === "success") {
      return json({ success: true });
    }

    const failure = RESULT_ERRORS[data];

    if (failure) {
      return fail(
        failure.message,
        failure.status
      );
    }

    throw new Error(
      "Unexpected subscription result"
    );
  } catch (error) {
    console.error("[Push] Subscription failed:", {
      message: error?.message,
      code: error?.code,
    });

    return fail(
      "Could not save subscription",
      500
    );
  }
}