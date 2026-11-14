// src/app/api/push/subscribe/route.js

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const origin = request.headers.get("origin");

    if (origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Invalid origin" },
        { status: 403 }
      );
    }

    const subscription = await request.json();

    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    let endpointUrl;

    try {
      endpointUrl = new URL(endpoint);
    } catch {
      return NextResponse.json(
        { error: "Invalid endpoint" },
        { status: 400 }
      );
    }

    if (
      endpointUrl.protocol !== "https:" ||
      endpointUrl.username ||
      endpointUrl.password ||
      endpointUrl.port ||
      !p256dh ||
      !auth ||
      typeof p256dh !== "string" ||
      typeof auth !== "string" ||
      p256dh.length > 256 ||
      auth.length > 256 ||
      endpoint.length > 4096
    ) {
      return NextResponse.json(
        { error: "Invalid subscription" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { error } = await admin
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

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push subscription failed:", error);

    return NextResponse.json(
      { error: "Could not save subscription" },
      { status: 500 }
    );
  }
}
