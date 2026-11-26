// src/lib/server/linkPreviewRateLimit.js

import "server-only";

import {
  PREVIEW_RATE_LIMIT,
  PREVIEW_RATE_WINDOW,
} from "@/constants/linkPreviews";

export async function consumePreviewQuota(
  admin,
  userId
) {
  const { data, error } = await admin.rpc(
    "consume_link_preview_quota",
    {
      target_user_id: userId,
      max_requests: PREVIEW_RATE_LIMIT,
      window_seconds: PREVIEW_RATE_WINDOW,
    }
  );

  if (error) {
    throw new Error(
      "Unable to verify link preview quota"
    );
  }

  return data === true;
}