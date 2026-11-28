// src/utils/urlUtils.js

import {
  MAX_URL_LENGTH,
  MAX_PREVIEWS_PER_MESSAGE,
  ALLOWED_PROTOCOLS,
} from "@/constants/linkPreviews";

const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>"`]+/gi;

const BRACKET_PAIRS = [
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
];

/* -------------------- PUNCTUATION -------------------- */

function trimTrailingPunctuation(value) {
  let url = value.replace(/[.,!?;:]+$/g, "");

  for (const [open, close] of BRACKET_PAIRS) {
    if (!url.endsWith(close)) continue;

    let balance = 0;

    for (const character of url) {
      if (character === open) balance++;
      if (character === close) balance--;
    }

    while (
      balance < 0 &&
      url.endsWith(close)
    ) {
      url = url.slice(0, -1);
      balance++;
    }
  }

  return url;
}

/* -------------------- URL PARSING -------------------- */

function parseUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  let input = value.trim();

  if (
    !input ||
    input.length > MAX_URL_LENGTH
  ) {
    return null;
  }

  if (/^www\./i.test(input)) {
    input = `https://${input}`;
  }

  try {
    const url = new URL(input);

    if (
      !ALLOWED_PROTOCOLS.has(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function getNormalizedHref(url) {
  const href = url.href;

  const fragmentIndex = href.indexOf("#");

  const normalized =
    fragmentIndex === -1
      ? href
      : href.slice(0, fragmentIndex);

  return normalized.length <= MAX_URL_LENGTH
    ? normalized
    : null;
}

export function normalizeUrl(value) {
  const url = parseUrl(value);

  return url
    ? getNormalizedHref(url)
    : null;
}

/* -------------------- URL MATCHING -------------------- */

function* findUrls(value) {
  const text =
    typeof value === "string" ? value : "";

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = trimTrailingPunctuation(
      match[0]
    );

    const parsed = parseUrl(raw);

    if (!parsed) continue;

    const normalized =
      getNormalizedHref(parsed);

    if (!normalized) continue;

    yield {
      raw,
      href: parsed.href,
      normalized,
      start: match.index,
      end: match.index + raw.length,
    };
  }
}

/* -------------------- MESSAGE TEXT -------------------- */

export function splitMessageText(value) {
  const text =
    typeof value === "string" ? value : "";

  const parts = [];

  let lastIndex = 0;

  for (const match of findUrls(text)) {
    if (match.start > lastIndex) {
      parts.push({
        type: "text",
        value: text.slice(
          lastIndex,
          match.start
        ),
      });
    }

    parts.push({
      type: "link",
      value: match.raw,
      url: match.href,
    });

    lastIndex = match.end;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return parts;
}

/* -------------------- PREVIEW EXTRACTION -------------------- */

export function extractUrls(
  text,
  limit = MAX_PREVIEWS_PER_MESSAGE
) {
  if (limit <= 0) return [];

  const urls = new Set();

  for (const match of findUrls(text)) {
    urls.add(match.normalized);

    if (urls.size >= limit) {
      break;
    }
  }

  return [...urls];
}

/* -------------------- HOSTNAME -------------------- */

export function getUrlHostname(value) {
  try {
    return new URL(value).hostname.replace(
      /^www\./i,
      ""
    );
  } catch {
    return "";
  }
}