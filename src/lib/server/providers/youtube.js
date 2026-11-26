// src/lib/server/providers/youtube.js

import "server-only";

import { safeFetchJson } from "../safeFetch";
import { getCanonicalYouTubeVideoUrl } from "@/utils/youtubeUtils";
import { normalizeUrl } from "@/utils/urlUtils";
import { YOUTUBE_OEMBED_ENDPOINT, MAX_TITLE_LENGTH, MAX_SITE_NAME_LENGTH } from "@/constants/linkPreviews";

/* -------------------- PROVIDER SETTINGS -------------------- */

const ALLOWED_PROVIDER_HOSTS = new Set(["www.youtube.com"]);
const ALLOWED_THUMBNAIL_HOSTS = new Set(["i.ytimg.com", "img.youtube.com"]);

/* -------------------- TEXT CLEANING -------------------- */

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  return Array.from(cleaned)
    .slice(0, maxLength)
    .join("");
}

/* -------------------- THUMBNAIL VALIDATION -------------------- */

function validateThumbnail(value) {
  const normalized = normalizeUrl(value);

  if (!normalized) return null;

  try {
    const url = new URL(normalized);

    if (
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      !ALLOWED_THUMBNAIL_HOSTS.has(url.hostname)
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

/* -------------------- OEMBED URL -------------------- */

function createOEmbedUrl(videoUrl) {
  const endpoint = new URL(
    YOUTUBE_OEMBED_ENDPOINT
  );

  endpoint.searchParams.set(
    "url",
    videoUrl
  );

  endpoint.searchParams.set(
    "format",
    "json"
  );

  return endpoint.href;
}

/* -------------------- RESPONSE PARSING -------------------- */

export function parseYouTubeMetadata(
  data,
  videoUrl
) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data.type !== "video"
  ) {
    return null;
  }

  const title = cleanText(
    data.title,
    MAX_TITLE_LENGTH
  );

  if (!title) {
    return null;
  }

  const siteName =
    cleanText(
      data.provider_name,
      MAX_SITE_NAME_LENGTH
    ) || "YouTube";

  const imageUrl = validateThumbnail(
    data.thumbnail_url
  );

  return {
    final_url: videoUrl,

    title,

    description: null,

    image_url: imageUrl,

    site_name: siteName,
  };
}

/* -------------------- PUBLIC PROVIDER -------------------- */

export async function extractYouTubeMetadata(value, { timeoutMs } = {}) {
  const videoUrl = getCanonicalYouTubeVideoUrl(value);

  if (!videoUrl) {
    return null;
  }

  const endpoint = createOEmbedUrl(videoUrl);

  const { data } = await safeFetchJson(endpoint, {
    allowedHostnames: ALLOWED_PROVIDER_HOSTS,
    maxRedirects: 0,
    timeoutMs,
  });

  return parseYouTubeMetadata(data, videoUrl);
}