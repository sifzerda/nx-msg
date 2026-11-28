// src/lib/extras/gifs.js

import {
  GIPHY_API_URL,
  GIPHY_API_KEY,
  GIF_PAGE_SIZE,
  GIF_MAX_QUERY_LENGTH,
  GIF_RATING,
  GIF_ID_PATTERN,
} from "@/constants/gifs";

const MAX_SEARCH_OFFSET = 4999;
const MAX_TRENDING_OFFSET = 499;

const EMPTY_GIFS = Object.freeze([]);

/* -------------------- VALIDATION -------------------- */

export function isValidGifId(id) {
  return (
    typeof id === "string" &&
    GIF_ID_PATTERN.test(id)
  );
}

function isValidOffset(offset) {
  return (
    Number.isSafeInteger(offset) &&
    offset >= 0
  );
}

function getPaginationNumber(value, fallback) {
  return isValidOffset(value)
    ? value
    : fallback;
}

function emptyPage(offset) {
  return {
    gifs: EMPTY_GIFS,
    nextOffset: offset,
    hasMore: false,
  };
}

/* -------------------- REQUEST -------------------- */

async function requestGiphy(
  endpoint,
  parameters = {},
  signal
) {
  signal?.throwIfAborted();

  if (!GIPHY_API_KEY) {
    throw new Error("GIPHY API key is missing");
  }

  const url = new URL(
    `${GIPHY_API_URL}/${endpoint}`
  );

  url.searchParams.set(
    "api_key",
    GIPHY_API_KEY
  );

  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(
        key,
        String(value)
      );
    }
  }

  const response = await fetch(
    url.toString(),
    {
      signal,
      cache: "no-store",
    }
  );

  if (response.status === 429) {
    throw new Error(
      "GIPHY rate limit reached. Please try again later."
    );
  }

  if (!response.ok) {
    throw new Error(
      `GIPHY request failed (${response.status})`
    );
  }

  const result = await response.json();

  signal?.throwIfAborted();

  if (!result || typeof result !== "object") {
    throw new Error("Invalid GIPHY response");
  }

  if (
    result.meta?.status &&
    result.meta.status !== 200
  ) {
    throw new Error(
      result.meta.msg ||
      "GIPHY request failed"
    );
  }

  return result;
}

/* -------------------- NORMALISATION -------------------- */

function normalizeGif(gif) {
  if (!isValidGifId(gif?.id)) {
    return null;
  }

  const images = gif.images;

  if (!images) return null;

  const previewUrl =
    images.fixed_width?.url ||
    images.original?.url;

  const url =
    images.downsized?.url ||
    images.original?.url;

  if (!previewUrl || !url) {
    return null;
  }

  return {
    id: gif.id,

    title: gif.title || "GIF",

    previewUrl,
    url,

    stillUrl:
      images.fixed_width_still?.url || null,

    mp4Url:
      images.fixed_width?.mp4 || null,

    width:
      Number(images.fixed_width?.width) || 200,

    height:
      Number(images.fixed_width?.height) || 200,
  };
}

/* -------------------- SEARCH -------------------- */

export async function searchGifs({
  query = "",
  offset = 0,
  signal,
} = {}) {
  if (!isValidOffset(offset)) {
    throw new Error("Invalid GIF pagination offset");
  }

  const cleanQuery =
    typeof query === "string"
      ? query.trim().slice(
          0,
          GIF_MAX_QUERY_LENGTH
        )
      : "";

  const isSearch = Boolean(cleanQuery);

  const endpoint = isSearch
    ? "search"
    : "trending";

  const maxOffset = isSearch
    ? MAX_SEARCH_OFFSET
    : MAX_TRENDING_OFFSET;

  if (offset > maxOffset) {
    return emptyPage(offset);
  }

  const parameters = {
    limit: Math.min(
      GIF_PAGE_SIZE,
      maxOffset - offset + 1
    ),

    offset,
    rating: GIF_RATING,
  };

  if (isSearch) {
    parameters.q = cleanQuery;
  }

  const result = await requestGiphy(
    endpoint,
    parameters,
    signal
  );

  if (!Array.isArray(result.data)) {
    throw new Error(
      "Invalid GIPHY search response"
    );
  }

  const gifs = [];

  for (const item of result.data) {
    const gif = normalizeGif(item);

    if (gif) {
      gifs.push(gif);
    }
  }

  const pagination = result.pagination || {};

  const count = getPaginationNumber(
    pagination.count,
    result.data.length
  );

  const pageOffset = getPaginationNumber(
    pagination.offset,
    offset
  );

  const nextOffset = pageOffset + count;

  const totalCount = getPaginationNumber(
    pagination.total_count,
    nextOffset
  );

  const hasMore =
    count > 0 &&
    nextOffset > offset &&
    nextOffset < totalCount &&
    nextOffset <= maxOffset;

  return {
    gifs,
    nextOffset,
    hasMore,
  };
}

/* -------------------- SINGLE GIF -------------------- */

export async function getGifById(id, signal) {
  if (!isValidGifId(id)) {
    throw new Error("Invalid GIF ID");
  }

  const result = await requestGiphy(
    encodeURIComponent(id),
    {},
    signal
  );

  const gif = normalizeGif(result.data);

  if (!gif) {
    throw new Error("GIF is unavailable");
  }

  return gif;
}