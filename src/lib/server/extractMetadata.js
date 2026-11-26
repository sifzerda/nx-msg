// src/lib/server/extractMetadata.js

import "server-only";

import { load } from "cheerio";

import { safeFetchHtml } from "./safeFetch";

import {
  normalizeUrl,
  getUrlHostname,
} from "@/utils/urlUtils";

import {
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_SITE_NAME_LENGTH,
} from "@/constants/linkPreviews";

/* -------------------- TEXT CLEANING -------------------- */

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  return Array.from(cleaned)
    .slice(0, maxLength)
    .join("");
}

function firstText(values, maxLength) {
  for (const value of values) {
    const cleaned = cleanText(
      value,
      maxLength
    );

    if (cleaned) return cleaned;
  }

  return null;
}

/* -------------------- META TAGS -------------------- */

function getMeta($, key) {
  return (
    $(`meta[property="${key}"]`)
      .first()
      .attr("content") ||

    $(`meta[name="${key}"]`)
      .first()
      .attr("content") ||

    null
  );
}

/* -------------------- IMAGE URL -------------------- */

function resolveImageUrl(value, baseUrl) {
  if (typeof value !== "string") {
    return null;
  }

  const input = value.trim();

  if (!input) return null;

  try {
    const url = new URL(input, baseUrl);

    // Only retain HTTPS image candidates.
    if (url.protocol !== "https:") {
      return null;
    }

    return normalizeUrl(url.href);
  } catch {
    return null;
  }
}

/* -------------------- HTML EXTRACTION -------------------- */

export function parseMetadata(html, finalUrl) {
  const $ = load(html);

  const hostname = getUrlHostname(finalUrl);

  const title = firstText(
    [
      getMeta($, "og:title"),
      getMeta($, "twitter:title"),
      $("title").first().text(),
    ],
    MAX_TITLE_LENGTH
  );

  const description = firstText(
    [
      getMeta($, "og:description"),
      getMeta($, "twitter:description"),
      getMeta($, "description"),
    ],
    MAX_DESCRIPTION_LENGTH
  );

  const siteName = firstText(
    [
      getMeta($, "og:site_name"),
      getMeta($, "application-name"),
      hostname,
    ],
    MAX_SITE_NAME_LENGTH
  );

  const imageCandidates = [
    getMeta($, "og:image:secure_url"),
    getMeta($, "og:image"),
    getMeta($, "og:image:url"),
    getMeta($, "twitter:image"),
    getMeta($, "twitter:image:src"),
    $('link[rel="image_src"]')
      .first()
      .attr("href"),
  ];

  let imageUrl = null;

  for (const candidate of imageCandidates) {
    imageUrl = resolveImageUrl(
      candidate,
      finalUrl
    );

    if (imageUrl) break;
  }

  return {
    final_url: finalUrl,
    title: title || hostname,
    description,
    image_url: imageUrl,
    site_name: siteName,
  };
}

/* -------------------- FETCH AND EXTRACT -------------------- */

export async function extractMetadata(value) {
  const { html, finalUrl } =
    await safeFetchHtml(value);

  return parseMetadata(html, finalUrl);
}