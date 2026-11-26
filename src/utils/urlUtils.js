// src/utils/urlUtils.js

import {
  MAX_URL_LENGTH,
  MAX_PREVIEWS_PER_MESSAGE,
  ALLOWED_PROTOCOLS,
} from "@/constants/linkPreviews";

const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>"`]+/gi;

function trimTrailingPunctuation(value) {
  let url = value.replace(/[.,!?;:]+$/g, "");

  const pairs = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ];

  for (const [open, close] of pairs) {
    while (url.endsWith(close)) {
      const opening = url.split(open).length - 1;
      const closing = url.split(close).length - 1;

      if (closing <= opening) break;

      url = url.slice(0, -1);
    }
  }

  return url;
}

export function normalizeUrl(value) {
  if (typeof value !== "string") return null;

  let input = value.trim();

  if (!input || input.length > MAX_URL_LENGTH) {
    return null;
  }

  if (/^www\./i.test(input)) {
    input = `https://${input}`;
  }

  try {
    const url = new URL(input);

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      return null;
    }

    if (url.username || url.password) {
      return null;
    }

    if (!url.hostname) {
      return null;
    }

    // Fragments do not affect fetched page metadata.
    url.hash = "";

    const normalized = url.href;

    return normalized.length <= MAX_URL_LENGTH
      ? normalized
      : null;
  } catch {
    return null;
  }
}

export function splitMessageText(value) {
  const text =
    typeof value === "string" ? value : "";

  const parts = [];

  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = trimTrailingPunctuation(match[0]);
    const url = normalizeUrl(raw);

    if (!url) continue;

    const start = match.index;
    const end = start + raw.length;

    if (start > lastIndex) {
      parts.push({
        type: "text",
        value: text.slice(lastIndex, start),
      });
    }

    // Preserve fragments for clickable links.
    const href = new URL(
      /^www\./i.test(raw)
        ? `https://${raw}`
        : raw
    ).href;

    parts.push({
      type: "link",
      value: raw,
      url: href,
    });

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return parts;
}

export function extractUrls(
  text,
  limit = MAX_PREVIEWS_PER_MESSAGE
) {
  if (limit <= 0) return [];

  const urls = new Set();

  for (const part of splitMessageText(text)) {
    if (part.type !== "link") continue;

    const url = normalizeUrl(part.url);

    if (!url) continue;

    urls.add(url);

    if (urls.size >= limit) break;
  }

  return [...urls];
}

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