// src/lib/messageSearch.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export const SEARCH_PAGE_SIZE = 30;
export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 200;

export async function searchMessages({
  conversationId,
  query = "",
  cursor = null,
  signal,
}) {
  const searchQuery = query.trim();
  const length = Array.from(searchQuery).length;

  if (
    !conversationId ||
    length < MIN_SEARCH_LENGTH ||
    length > MAX_SEARCH_LENGTH
  ) {
    return {
      results: [],
      hasMore: false,
      nextCursor: null,
    };
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