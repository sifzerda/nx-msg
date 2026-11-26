// src/constants/linkPreviews.js

// src/constants/linkPreviews.js

/* -------------------- URL SETTINGS -------------------- */

export const MAX_URL_LENGTH = 2048;

export const MAX_PREVIEWS_PER_MESSAGE = 1;

export const ALLOWED_PROTOCOLS = new Set([
    "http:",
    "https:",
]);

/* -------------------- NETWORK SETTINGS -------------------- */

export const MAX_REDIRECTS = 3;

export const FETCH_TIMEOUT = 6000;

export const MAX_HTML_BYTES = 2 * 1024 * 1024;

export const MAX_PENDING_REQUESTS = 10;

export const ALLOWED_CONTENT_TYPES = new Set([
    "text/html",
    "application/xhtml+xml",
]);

/* -------------------- METADATA SETTINGS -------------------- */

export const MAX_TITLE_LENGTH = 300;

export const MAX_DESCRIPTION_LENGTH = 1000;

export const MAX_SITE_NAME_LENGTH = 100;

export const MAX_JSON_LD_SCRIPTS = 10;

export const MAX_JSON_LD_LENGTH = 128 * 1024;

export const MAX_JSON_LD_NODES = 100;

export const MAX_JSON_LD_DEPTH = 8;

export const MAX_IMAGE_CANDIDATES = 30;

export const PREVIEW_QUALITY = Object.freeze({
    COMPLETE: "complete",
    PARTIAL: "partial",
    BASIC: "basic",
    FAILED: "failed",
});

/* -------------------- CACHE SETTINGS -------------------- */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const SUCCESS_CACHE_TTL = 7 * DAY;

export const PARTIAL_CACHE_TTL = DAY;

export const BASIC_CACHE_TTL = 6 * HOUR;

export const FAILED_CACHE_TTL = HOUR;

export const METADATA_MEMORY_CACHE_TTL = 15 * 60 * 1000;

export const MAX_METADATA_CACHE_ENTRIES = 300;

/* -------------------- IMAGE SETTINGS -------------------- */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const MAX_IMAGE_PIXELS = 16_000_000;

export const PREVIEW_IMAGE_WIDTH = 640;

export const PREVIEW_IMAGE_HEIGHT = 360;

export const PREVIEW_IMAGE_QUALITY = 80;

export const IMAGE_CACHE_TTL = HOUR;

export const FAILED_IMAGE_CACHE_TTL = HOUR;

export const MAX_IMAGE_CACHE_ENTRIES = 100;

export const MAX_FAILED_IMAGE_CACHE_ENTRIES = 200;

export const MAX_IMAGE_CACHE_BYTES = 16 * 1024 * 1024;

export const MAX_PENDING_IMAGE_REQUESTS = 3;

export const ALLOWED_IMAGE_CONTENT_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);

/* -------------------- RATE LIMITING -------------------- */

export const PREVIEW_RATE_LIMIT = 30;

export const PREVIEW_RATE_WINDOW = 60;

/* -------------------- YOUTUBE SETTINGS -------------------- */

export const YOUTUBE_OEMBED_ENDPOINT = "https://www.youtube.com/oembed";
export const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
export const MAX_JSON_BYTES = 64 * 1024;
export const ALLOWED_JSON_CONTENT_TYPES = new Set([ "application/json" ]);

export const YOUTUBE_HOSTNAMES = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);