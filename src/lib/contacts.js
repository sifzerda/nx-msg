// src/lib/contacts.js

import { createClient } from "@/lib/supabase/client";
import { isUuid } from "@/utils/validation";

const supabase = createClient();

const PROFILE_COLUMNS = "id, username, display_name, avatar_url";

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 100;
const SEARCH_LIMIT = 20;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -------------------- HELPERS -------------------- */

function validateContactId(contactId) {
  if (!isUuid(contactId)) {
    throw new Error("Invalid contact ID.");
  }
}

function normalizeSearch(query) {
  if (typeof query !== "string") {
    return "";
  }

  return query
    .trim()
    .slice(0, MAX_SEARCH_LENGTH)
    .replace(/[%_,()."\\]/g, "")
    .trim();
}

async function requireUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error("Not authenticated");
  }

  return user.id;
}

/* -------------------- SEARCH -------------------- */

export async function searchUsers(query) {
  const search = normalizeSearch(query);

  if (search.length < MIN_SEARCH_LENGTH) {
    return [];
  }

  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .or(
      `username.ilike.%${search}%,display_name.ilike.%${search}%`
    )
    .neq("id", userId)
    .order("username", { ascending: true })
    .order("id", { ascending: true })
    .limit(SEARCH_LIMIT);

  if (error) throw error;

  return data ?? [];
}

/* -------------------- CONTACTS -------------------- */

export async function getContacts() {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("contacts")
    .select(`
      id,
      profiles!contacts_contact_id_fkey (
        ${PROFILE_COLUMNS}
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const contacts = [];

  for (const row of data ?? []) {
    if (!row.profiles) continue;

    contacts.push({
      ...row.profiles,
      relationId: row.id,
    });
  }

  return contacts;
}

/* -------------------- ADD CONTACT -------------------- */

export async function addContact(contactId) {
  validateContactId(contactId);

  const userId = await requireUserId();

  if (userId === contactId) {
    throw new Error("You cannot add yourself");
  }

  const { error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      contact_id: contactId,
    });

  if (error) throw error;
}

/* -------------------- REMOVE CONTACT -------------------- */

export async function removeContact(contactId) {
  validateContactId(contactId);

  const userId = await requireUserId();

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("user_id", userId)
    .eq("contact_id", contactId);

  if (error) throw error;
}