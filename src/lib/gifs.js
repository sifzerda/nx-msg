// src/lib/gifs.js

import {
  GIPHY_API_URL,
  GIPHY_API_KEY,
  GIF_PAGE_SIZE,
  GIF_MAX_QUERY_LENGTH,
  GIF_RATING,
  GIF_ID_PATTERN,
} from "@/constants/gifs";

export function isValidGifId(id) {
  return (
    typeof id === "string" && GIF_ID_PATTERN.test(id)
  );
}

async function requestGiphy(
  endpoint,
  parameters = {},
  signal
) {
  if (!GIPHY_API_KEY) {
    throw new Error("GIPHY API key is missing");
  }

  const url = new URL(`${GIPHY_API_URL}/${endpoint}`);

  url.searchParams.set("api_key", GIPHY_API_KEY);

  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    signal,
    cache: "no-store",
  });

  if (response.status === 429) {
    throw new Error("GIPHY rate limit reached. Please try again later.");
  }

  if (!response.ok) {
    throw new Error(`GIPHY request failed (${response.status})`);
  }

  const result = await response.json();

  if (
    result.meta?.status && result.meta.status !== 200
  ) {
    throw new Error(result.meta.msg || "GIPHY request failed");
  }

  return result;
}

function normalizeGif(gif) {
  if (!isValidGifId(gif?.id)) {
    return null;
  }

  const images = gif.images;

  if (!images) return null;

  const previewUrl = images.fixed_width?.url || images.original?.url;
  const url = images.downsized?.url || images.original?.url;

  if (!previewUrl || !url) {
    return null;
  }

  return {
    id: gif.id,
    title: gif.title || "GIF",
    previewUrl,
    url,
    stillUrl: images.fixed_width_still?.url || null,
    mp4Url: images.fixed_width?.mp4 || null,
    width: Number(images.fixed_width?.width) || 200,
    height: Number(images.fixed_width?.height) || 200,
  };
}

export async function searchGifs({
  query = "",
  offset = 0,
  signal,
} = {}) {
  const cleanQuery = query
    .trim()
    .slice(0, GIF_MAX_QUERY_LENGTH);

  const isSearch = Boolean(cleanQuery);
  const endpoint = isSearch ? "search" : "trending";
  const maxOffset = isSearch ? 4999 : 499;

  if (offset > maxOffset) {
    return {
      gifs: [],
      nextOffset: offset,
      hasMore: false,
    };
  }

  const parameters = {
    limit: GIF_PAGE_SIZE,
    offset,
    rating: GIF_RATING,
  };

  if (isSearch) {
    parameters.q = cleanQuery;
  }

  const result = await requestGiphy(endpoint, parameters, signal);

  const gifs = (result.data || [])
    .map(normalizeGif)
    .filter(Boolean);

  const pagination = result.pagination || {};
  const count = pagination.count ?? result.data?.length ?? 0;
  const nextOffset = (pagination.offset ?? offset) + count;
  const totalCount = pagination.total_count ?? nextOffset;

  return {
    gifs,
    nextOffset,
    hasMore: count > 0 && nextOffset < totalCount && nextOffset <= maxOffset,
  };
}

export async function getGifById(id, signal) {
  if (!isValidGifId(id)) {
    throw new Error("Invalid GIF ID");
  }

  const result = await requestGiphy(encodeURIComponent(id), {}, signal);
  const gif = normalizeGif(result.data);

  if (!gif) {
    throw new Error("GIF is unavailable");
  }

  return gif;
}