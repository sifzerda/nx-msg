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

    const origin = request.headers.get("origin");

    if (origin !== new URL(request.url).origin) {
      return respond("Invalid origin", 403);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return respond("Invalid JSON body", 400);
    }

    const endpoint = body?.endpoint;

    if (
      typeof endpoint !== "string" ||
      !endpoint ||
      endpoint.length > 4096
    ) {
      return respond("Invalid endpoint", 400);
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (error) {
      console.error(
        "[Push] Unsubscribe database error:",
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
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

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Push unsubscribe route is working",
  });
}