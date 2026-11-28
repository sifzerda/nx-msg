// src/lib/messageSearch.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const SEARCH_PAGE_SIZE = 30;
export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 200;

const EMPTY_RESULT = Object.freeze({
  results: Object.freeze([]),
  hasMore: false,
  nextCursor: null,
});

/* -------------------- VALIDATION -------------------- */

function isValidCursor(cursor) {
  return (
    cursor !== null &&
    typeof cursor === "object" &&
    typeof cursor.created_at === "string" &&
    cursor.created_at.length > 0 &&
    typeof cursor.id === "string" &&
    cursor.id.length > 0
  );
}

/* -------------------- SEARCH -------------------- */

export async function searchMessages({
  conversationId,
  query = "",
  cursor = null,
  signal,
} = {}) {
  const searchQuery =
    typeof query === "string"
      ? query.trim()
      : "";

  const length = Array.from(searchQuery).length;

  if (
    !conversationId ||
    length < MIN_SEARCH_LENGTH ||
    length > MAX_SEARCH_LENGTH
  ) {
    return EMPTY_RESULT;
  }

  if (
    cursor !== null &&
    !isValidCursor(cursor)
  ) {
    throw new Error(
      "Invalid search pagination cursor"
    );
  }

  // Avoid initiating a request that has
  // already been cancelled.
  signal?.throwIfAborted();

  let request = supabase.rpc(
    "search_chat_messages",
    {
      chat_id: conversationId,
      search_query: searchQuery,
      result_limit: SEARCH_PAGE_SIZE + 1,
      before_created_at:
        cursor?.created_at ?? null,
      before_id:
        cursor?.id ?? null,
    }
  );

  if (signal) {
    request = request.abortSignal(signal);
  }

  const { data, error } = await request;

  signal?.throwIfAborted();

  if (error) throw error;

  if (data !== null && !Array.isArray(data)) {
    throw new Error(
      "Invalid message search response"
    );
  }

  const rows = data ?? [];

  if (!rows.length) {
    return EMPTY_RESULT;
  }

  const hasMore =
    rows.length > SEARCH_PAGE_SIZE;

  const results = hasMore
    ? rows.slice(0, SEARCH_PAGE_SIZE)
    : rows;

  const last = results.at(-1);

  return {
    results,
    hasMore,

    nextCursor: hasMore
      ? {
          created_at: last.created_at,
          id: last.id,
        }
      : null,
  };
}