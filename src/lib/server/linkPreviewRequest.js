// src/lib/server/linkPreviewRequest.js

import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/utils/validation";
import {
    consumePreviewQuota,
    PreviewBusyError,
} from "./linkPreviewCache";
import { extractPreviewUrl } from "@/utils/previewUrlPolicy";
import { PREVIEW_RATE_WINDOW } from "@/constants/linkPreviews";

/* -------------------- CONSTANTS -------------------- */

const MAX_REQUEST_BYTES = 1024;

export const RESPONSE_HEADERS = Object.freeze({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
});

/* -------------------- ERRORS -------------------- */

class PreviewRequestError extends Error {
    constructor(status, message, headers = {}) {
        super(message);

        this.name = "PreviewRequestError";
        this.status = status;
        this.headers = headers;
    }
}

/* -------------------- REQUEST VALIDATION -------------------- */

export function validateMessageId(value) {
    if (!isUuid(value)) {
        throw new PreviewRequestError(400, "Invalid message ID");
    }

    return value;
}

export function validateRequestOrigin(
    request,
    { requireOrigin = false } = {}
) {
    const fetchSite = request.headers.get("sec-fetch-site");

    if (
        fetchSite &&
        fetchSite !== "same-origin" &&
        fetchSite !== "none"
    ) {
        throw new PreviewRequestError(
            403,
            "Forbidden request origin"
        );
    }

    const origin = request.headers.get("origin");

    if (!origin && !requireOrigin) {
        return;
    }

    if (
        !origin ||
        origin !== new URL(request.url).origin
    ) {
        throw new PreviewRequestError(
            403,
            "Forbidden request origin"
        );
    }
}

/* -------------------- JSON BODY -------------------- */

export async function readPreviewRequest(request) {
    const contentType = (
        request.headers.get("content-type") || ""
    )
        .split(";")[0]
        .trim()
        .toLowerCase();

    const declaredLength = Number(
        request.headers.get("content-length")
    );

    if (
        contentType !== "application/json" ||
        declaredLength > MAX_REQUEST_BYTES ||
        !request.body
    ) {
        throw new PreviewRequestError(
            400,
            "Invalid request body"
        );
    }

    const reader = request.body.getReader();
    const decoder = new TextDecoder("utf-8", {
        fatal: true,
    });

    let totalBytes = 0;
    let body = "";

    try {
        while (true) {
            const { done, value } =
                await reader.read();

            if (done) break;

            totalBytes += value.byteLength;

            if (totalBytes > MAX_REQUEST_BYTES) {
                throw new Error("Request body too large");
            }

            body += decoder.decode(value, {
                stream: true,
            });
        }

        body += decoder.decode();

        const parsed = JSON.parse(body);

        if (
            !parsed ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
        ) {
            throw new Error("Invalid JSON object");
        }

        return parsed;
    } catch {
        throw new PreviewRequestError(
            400,
            "Invalid request body"
        );
    } finally {
        try {
            await reader.cancel();
        } catch {
            // Stream may already be closed.
        }

        reader.releaseLock();
    }
}

/* -------------------- AUTHORISED MESSAGE -------------------- */

export async function getPreviewContext(messageId) {
    validateMessageId(messageId);

    const supabase = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new PreviewRequestError(
            401,
            "Unauthorized"
        );
    }

    const {
        data: message,
        error: messageError,
    } = await supabase
        .from("messages")
        .select("conversation_id, content")
        .eq("id", messageId)
        .maybeSingle();

    if (messageError) {
        throw new PreviewRequestError(
            500,
            "Unable to retrieve message"
        );
    }

    if (!message) {
        throw new PreviewRequestError(
            404,
            "Message not found"
        );
    }

    /* Retain until message RLS has been verified. */

    const {
        data: isMember,
        error: membershipError,
    } = await supabase.rpc("is_chat_member", {
        chat_id: message.conversation_id,
    });

    if (membershipError) {
        throw new PreviewRequestError(
            500,
            "Unable to verify membership"
        );
    }

    if (isMember !== true) {
        throw new PreviewRequestError(
            404,
            "Message not found"
        );
    }

    const url = extractPreviewUrl(message.content);

    return {
        userId: user.id,
        url,

        // Do not initialise the admin client if the
        // message has no eligible preview URL.

        admin: url ? createAdminClient() : null,
    };
}

/* -------------------- RATE LIMIT -------------------- */

export async function enforcePreviewQuota(
    admin,
    userId
) {
    const allowed = await consumePreviewQuota(
        admin,
        userId
    );

    if (!allowed) {
        throw new PreviewRequestError(
            429,
            "Too many link preview requests",
            {
                "Retry-After": String(PREVIEW_RATE_WINDOW),
            }
        );
    }
}

/* -------------------- ERROR NORMALISATION -------------------- */

export function getPreviewError(error) {
    if (error instanceof PreviewRequestError) {
        return error;
    }

    if (error instanceof PreviewBusyError) {
        return new PreviewRequestError(
            503,
            "Link preview service is busy",
            {
                "Retry-After": "5",
            }
        );
    }

    return null;
}