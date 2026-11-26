// src/app/api/link-preview/route.js

import { NextResponse } from "next/server";

import {
    createClient,
} from "@/lib/supabase/server";

import {
    createAdminClient,
} from "@/lib/supabase/admin";

import {
    getCachedPreview,
    generateLinkPreview,
    serializePreview,
    PreviewBusyError,
} from "@/lib/server/linkPreviewCache";

import {
    consumePreviewQuota,
} from "@/lib/server/linkPreviewRateLimit";

import {
    extractUrls,
} from "@/utils/urlUtils";

import {
    PREVIEW_RATE_WINDOW,
} from "@/constants/linkPreviews";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export const maxDuration = 15;

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_REQUEST_BYTES = 1024;

/* -------------------- RESPONSES -------------------- */

function json(data, status = 200, headers = {}) {
    return NextResponse.json(data, {
        status,

        headers: {
            "Cache-Control": "private, no-store",
            ...headers,
        },
    });
}

/* -------------------- REQUEST VALIDATION -------------------- */

function isSameOrigin(request) {
    const origin =
        request.headers.get("origin");

    if (!origin) {
        return false;
    }

    try {
        return (
            new URL(origin).origin ===
            new URL(request.url).origin
        );
    } catch {
        return false;
    }
}

async function readRequestBody(request) {
    const contentType = (
        request.headers.get("content-type") || ""
    )
        .split(";")[0]
        .trim()
        .toLowerCase();

    if (contentType !== "application/json") {
        throw new Error("Unsupported content type");
    }

    const declaredLength = Number(
        request.headers.get("content-length")
    );

    if (declaredLength > MAX_REQUEST_BYTES) {
        throw new Error("Request body too large");
    }

    if (!request.body) {
        throw new Error("Missing request body");
    }

    const reader = request.body.getReader();

    const decoder = new TextDecoder();

    let totalBytes = 0;
    let body = "";

    try {
        while (true) {
            const { done, value } =
                await reader.read();

            if (done) break;

            totalBytes += value.byteLength;

            if (totalBytes > MAX_REQUEST_BYTES) {
                throw new Error(
                    "Request body too large"
                );
            }

            body += decoder.decode(value, {
                stream: true,
            });
        }

        body += decoder.decode();

        return JSON.parse(body);
    } finally {
        try {
            await reader.cancel();
        } catch {
            // The stream may already be closed.
        }

        reader.releaseLock();
    }
}

/* -------------------- API ENDPOINT -------------------- */

export async function POST(request) {
    try {
        /* Verify request origin */

        if (!isSameOrigin(request)) {
            return json(
                { error: "Forbidden request origin" },
                403
            );
        }

        /* Authenticate user */

        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return json(
                { error: "Unauthorized" },
                401
            );
        }

        /* Validate request body */

        let body;

        try {
            body = await readRequestBody(request);
        } catch {
            return json(
                { error: "Invalid request body" },
                400
            );
        }

        const messageId = body?.messageId;

        if (
            typeof messageId !== "string" ||
            !UUID_PATTERN.test(messageId)
        ) {
            return json(
                { error: "Invalid message ID" },
                400
            );
        }

        /* Retrieve message using the authenticated client.
    
           Existing message RLS policies restrict access
           to conversation members.
        */

        const {
            data: message,
            error: messageError,
        } = await supabase
            .from("messages")
            .select("id, conversation_id, content")
            .eq("id", messageId)
            .maybeSingle();

        if (messageError) {
            return json(
                { error: "Unable to retrieve message" },
                500
            );
        }

        if (!message) {
            return json(
                { error: "Message not found" },
                404
            );
        }

        /* Explicit membership verification */

        const {
            data: isMember,
            error: membershipError,
        } = await supabase.rpc(
            "is_chat_member",
            {
                chat_id: message.conversation_id,
            }
        );

        if (membershipError) {
            return json(
                { error: "Unable to verify membership" },
                500
            );
        }

        if (isMember !== true) {
            return json(
                { error: "Message not found" },
                404
            );
        }

        /* Extract the first URL from the stored message */

        const [url] = extractUrls(
            message.content
        );

        if (!url) {
            return json({
                preview: null,
            });
        }

        /* Use the service role only for cache operations */

        const admin = createAdminClient();

        const cached = await getCachedPreview(
            admin,
            url
        );

        if (cached) {
            return json({
                preview: serializePreview(cached),
                cached: true,
            });
        }

        /* Apply distributed rate limiting */

        const allowed = await consumePreviewQuota(
            admin,
            user.id
        );

        if (!allowed) {
            return json(
                {
                    error: "Too many link preview requests",
                },
                429,
                {
                    "Retry-After": String(
                        PREVIEW_RATE_WINDOW
                    ),
                }
            );
        }

        /* Fetch and cache missing metadata */

        const preview = await generateLinkPreview(
            admin,
            url,
            {
                cacheChecked: true,
            }
        );

        return json({
            preview: serializePreview(preview),
            cached: false,
        });
    } catch (error) {
        if (error instanceof PreviewBusyError) {
            return json(
                {
                    error: "Link preview service is busy",
                },
                503,
                {
                    "Retry-After": "5",
                }
            );
        }

        // Avoid logging message content, full URLs,
        // credentials or potentially sensitive query strings.

        console.error(
            "Link preview request failed"
        );

        return json(
            {
                error: "Unable to generate link preview",
            },
            500
        );
    }
}