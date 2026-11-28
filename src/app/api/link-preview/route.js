// src/app/api/link-preview/route.js

import { NextResponse } from "next/server";

import {
  getCachedPreview,
  generateLinkPreview,
  serializePreview,
} from "@/lib/server/linkPreviewCache";

import {
  RESPONSE_HEADERS,
  validateRequestOrigin,
  validateMessageId,
  readPreviewRequest,
  getPreviewContext,
  enforcePreviewQuota,
  getPreviewError,
} from "@/lib/server/linkPreviewRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/* -------------------- RESPONSE -------------------- */

function json(data, status = 200, headers = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      ...RESPONSE_HEADERS,
      ...headers,
    },
  });
}

/* -------------------- ENDPOINT -------------------- */

export async function POST(request) {
  try {
    validateRequestOrigin(request, {
      requireOrigin: true,
    });

    const body = await readPreviewRequest(request);

    const messageId = validateMessageId(
      body.messageId
    );

    const { admin, userId, url } =
      await getPreviewContext(messageId);

    if (!url) {
      return json({
        preview: null,
      });
    }

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

    await enforcePreviewQuota(admin, userId);

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
    const knownError = getPreviewError(error);

    if (knownError) {
      return json(
        {
          error: knownError.message,
        },
        knownError.status,
        knownError.headers
      );
    }

    console.error(
      "[LinkPreview] Request failed"
    );

    return json(
      {
        error: "Unable to generate link preview",
      },
      500
    );
  }
}