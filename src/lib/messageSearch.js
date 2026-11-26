// src/lib/messageSearch.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export const SEARCH_PAGE_SIZE = 30;
export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 200;

function emptyResults() {
  return {
    results: [],
    hasMore: false,
    nextCursor: null,
  };
}

export async function searchMessages({
  conversationId,
  query = "",
  cursor = null,
  signal,
}) {
  const searchQuery = query.trim();
  const queryLength = Array.from(searchQuery).length;

  if (
    !conversationId ||
    queryLength < MIN_SEARCH_LENGTH ||
    queryLength > MAX_SEARCH_LENGTH
  ) {
    return emptyResults();
  }

  if (
    cursor !== null &&
    (!cursor.created_at || !cursor.id)
  ) {
    throw new Error("Invalid search pagination cursor");
  }

  let request = supabase.rpc("search_chat_messages", {
    chat_id: conversationId,
    search_query: searchQuery,
    result_limit: SEARCH_PAGE_SIZE + 1,
    before_created_at: cursor?.created_at ?? null,
    before_id: cursor?.id ?? null,
  });

  if (signal) {
    request = request.abortSignal(signal);
  }

  const { data, error } = await request;

  if (error) throw error;

  const rows = data ?? [];
  const hasMore = rows.length > SEARCH_PAGE_SIZE;
  const results = rows.slice(0, SEARCH_PAGE_SIZE);
  const lastResult = results[results.length - 1];

  return {
    results,
    hasMore,
    nextCursor:
      hasMore && lastResult
        ? {
            created_at: lastResult.created_at,
            id: lastResult.id,
          }
        : null,
  };
}