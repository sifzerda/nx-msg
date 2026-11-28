// src/app/api/link-preview/image/route.js

import { getCachedPreview } from "@/lib/server/linkPreviewCache";

import {
  getPreviewImage,
  ImagePreviewBusyError,
  ImagePreviewUnavailableError,
} from "@/lib/server/linkPreviewImage";

import {
  RESPONSE_HEADERS,
  validateRequestOrigin,
  validateMessageId,
  getPreviewContext,
  enforcePreviewQuota,
  getPreviewError,
} from "@/lib/server/linkPreviewRequest";

import { isPreviewAllowed } from "@/utils/previewUrlPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/* -------------------- RESPONSE -------------------- */

function errorResponse(status, headers = {}) {
  return new Response(null, {
    status,
    headers: {
      ...RESPONSE_HEADERS,
      ...headers,
    },
  });
}

/* -------------------- ENDPOINT -------------------- */

export async function GET(request) {
  try {
    validateRequestOrigin(request);

    const messageId = validateMessageId(
      new URL(request.url)
        .searchParams
        .get("messageId")
    );

    const { admin, userId, url } =
      await getPreviewContext(messageId);

    if (!url) {
      return errorResponse(404);
    }

    const preview = await getCachedPreview(
      admin,
      url
    );

    const imageUrl = preview?.image_url;

    if (
      preview?.status !== "success" ||
      !imageUrl ||
      !isPreviewAllowed(imageUrl)
    ) {
      return errorResponse(404);
    }

    await enforcePreviewQuota(admin, userId);

    const buffer = await getPreviewImage(imageUrl);

    return new Response(buffer, {
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
    });
  } catch (error) {
    const knownError = getPreviewError(error);

    if (knownError) {
      return errorResponse(
        knownError.status,
        knownError.headers
      );
    }

    if (error instanceof ImagePreviewBusyError) {
      return errorResponse(503, {
        "Retry-After": "5",
      });
    }

    if (error instanceof ImagePreviewUnavailableError) {
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