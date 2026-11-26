// src/constants/linkPreviews.js

export const MAX_URL_LENGTH = 2048;
export const MAX_PREVIEWS_PER_MESSAGE = 1;
export const MAX_REDIRECTS = 3;
export const FETCH_TIMEOUT = 6000;
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_TITLE_LENGTH = 300;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_SITE_NAME_LENGTH = 100;
export const SUCCESS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
export const FAILED_CACHE_TTL = 60 * 60 * 1000;
export const MAX_PENDING_REQUESTS = 10;
export const PREVIEW_RATE_LIMIT = 30;
export const PREVIEW_RATE_WINDOW = 60;
export const ALLOWED_PROTOCOLS = new Set([ "http:", "https:" ]);
export const ALLOWED_CONTENT_TYPES = new Set([ "text/html", "application/xhtml+xml" ]);