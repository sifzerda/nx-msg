// src/app/api/link-preview/image/route.js

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedPreview, PreviewBusyError } from "@/lib/server/linkPreviewCache";
import { consumePreviewQuota } from "@/lib/server/linkPreviewRateLimit";
import { getPreviewImage, ImagePreviewBusyError, ImagePreviewUnavailableError } from "@/lib/server/linkPreviewImage";
import { extractUrls } from "@/utils/urlUtils";
import { isPreviewAllowed } from "@/utils/previewUrlPolicy";
import { PREVIEW_RATE_WINDOW } from "@/constants/linkPreviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RESPONSE_HEADERS = Object.freeze({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
});

/* -------------------- RESPONSES -------------------- */

function errorResponse(status, headers = {}) {
    return new Response(null, {
        status,

        headers: {
            ...RESPONSE_HEADERS,
            ...headers,
        },
    });
}

/* -------------------- API ENDPOINT -------------------- */

export async function GET(request) {
    try {
        /* -------------------- REQUEST VALIDATION -------------------- */

        const fetchSite =
            request.headers.get("sec-fetch-site");

        if (
            fetchSite &&
            fetchSite !== "same-origin" &&
            fetchSite !== "none"
        ) {
            return errorResponse(403);
        }

        const messageId = new URL(
            request.url
        ).searchParams.get("messageId");

        if (
            !messageId ||
            !UUID_PATTERN.test(messageId)
        ) {
            return errorResponse(400);
        }

        /* -------------------- AUTHENTICATION -------------------- */

        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return errorResponse(401);
        }

        /* -------------------- MESSAGE ACCESS -------------------- */

        const {
            data: message,
            error: messageError,
        } = await supabase
            .from("messages")
            .select("id, conversation_id, content")
            .eq("id", messageId)
            .maybeSingle();

        if (messageError) {
            return errorResponse(500);
        }

        if (!message) {
            return errorResponse(404);
        }

        /* -------------------- MEMBERSHIP VERIFICATION -------------------- */

        const {
            data: isMember,
            error: membershipError,
        } = await supabase.rpc("is_chat_member", {
            chat_id: message.conversation_id,
        });

        if (membershipError) {
            return errorResponse(500);
        }

        if (isMember !== true) {
            return errorResponse(404);
        }

        /* -------------------- URL VALIDATION -------------------- */

        const [url] = extractUrls(message.content, 1);

        if (!url || !isPreviewAllowed(url)) {
            return errorResponse(404);
        }

        /* -------------------- PREVIEW LOOKUP -------------------- */

        const admin = createAdminClient();

        const preview = await getCachedPreview(
            admin,
            url
        );

        if (
            !preview ||
            preview.status !== "success" ||
            !preview.image_url ||
            !isPreviewAllowed(preview.image_url)
        ) {
            return errorResponse(404);
        }

        /* -------------------- RATE LIMIT -------------------- */

        const allowed = await consumePreviewQuota(
            admin,
            user.id
        );

        if (!allowed) {
            return errorResponse(429, {
                "Retry-After": String(PREVIEW_RATE_WINDOW),
            });
        }

        /* -------------------- IMAGE PROCESSING -------------------- */

        const buffer = await getPreviewImage(
            preview.image_url
        );

        /* -------------------- IMAGE RESPONSE -------------------- */

        return new Response(
            new Uint8Array(buffer),
            {
                status: 200,

                headers: {
                    ...RESPONSE_HEADERS,

                    "Content-Type": "image/webp",

                    "Content-Length": String(
                        buffer.byteLength
                    ),

                    "Content-Security-Policy":
                        "default-src 'none'; sandbox",
                },
            }
        );
    } catch (error) {
        /* -------------------- ERROR HANDLING -------------------- */

        if (
            error instanceof ImagePreviewBusyError ||
            error instanceof PreviewBusyError
        ) {
            return errorResponse(503, {
                "Retry-After": "5",
            });
        }

        if (
            error instanceof ImagePreviewUnavailableError
        ) {
            return errorResponse(404);
        }

        if (process.env.NODE_ENV === "development") {
            console.error("[LinkPreviewImage] Failed", {
                name: error?.name,
                code: error?.code,
            });
        }

        return errorResponse(502);
    }
}