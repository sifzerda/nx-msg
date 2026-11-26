// src/utils/youtubeUtils.js

import { normalizeUrl } from "./urlUtils";

import {
  YOUTUBE_HOSTNAMES,
  YOUTUBE_VIDEO_ID_PATTERN,
} from "@/constants/linkPreviews";

const VIDEO_PATHS = new Set([
  "shorts",
  "embed",
  "live",
  "v",
]);

const SHORT_HOSTNAMES = new Set([
  "youtu.be",
  "www.youtu.be",
]);

const EMBED_HOSTNAMES = new Set([
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/* -------------------- VALIDATION -------------------- */

export function isValidYouTubeVideoId(value) {
  return (
    typeof value === "string" &&
    YOUTUBE_VIDEO_ID_PATTERN.test(value)
  );
}

function parseYouTubeUrl(value) {
  const normalized = normalizeUrl(value);

  if (!normalized) return null;

  try {
    const url = new URL(normalized);

    const hostname = url.hostname
      .toLowerCase()
      .replace(/\.$/, "");

    if (
      !YOUTUBE_HOSTNAMES.has(hostname) ||
      url.port ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return {
      url,
      hostname,
    };
  } catch {
    return null;
  }
}

/* -------------------- VIDEO EXTRACTION -------------------- */

export function getYouTubeVideoId(value) {
  const parsed = parseYouTubeUrl(value);

  if (!parsed) return null;

  const { url, hostname } = parsed;

  const segments = url.pathname
    .split("/")
    .filter(Boolean);

  let videoId = null;

  if (SHORT_HOSTNAMES.has(hostname)) {
    if (segments.length === 1) {
      videoId = segments[0];
    }
  } else if (EMBED_HOSTNAMES.has(hostname)) {
    if (
      segments.length === 2 &&
      segments[0] === "embed"
    ) {
      videoId = segments[1];
    }
  } else if (url.pathname === "/watch") {
    videoId = url.searchParams.get("v");
  } else if (
    segments.length === 2 &&
    VIDEO_PATHS.has(segments[0])
  ) {
    videoId = segments[1];
  }

  return isValidYouTubeVideoId(videoId)
    ? videoId
    : null;
}

/* -------------------- URL CLASSIFICATION -------------------- */

export function getYouTubeUrlType(value) {
  const parsed = parseYouTubeUrl(value);

  if (!parsed) return null;

  if (getYouTubeVideoId(value)) {
    return "video";
  }

  const { url, hostname } = parsed;

  if (
    SHORT_HOSTNAMES.has(hostname) ||
    EMBED_HOSTNAMES.has(hostname)
  ) {
    return "other";
  }

  const segments = url.pathname
    .split("/")
    .filter(Boolean);

  const first = segments[0] || "";

  if (
    first.startsWith("@") ||
    first === "channel" ||
    first === "user" ||
    first === "c"
  ) {
    return "channel";
  }

  if (
    first === "playlist" &&
    url.searchParams.has("list")
  ) {
    return "playlist";
  }

  return "other";
}

/* -------------------- CANONICAL VIDEO URL -------------------- */

export function getCanonicalYouTubeVideoUrl(value) {
  const videoId = getYouTubeVideoId(value);

  if (!videoId) return null;

  return `https://www.youtube.com/watch?v=${videoId}`;
}