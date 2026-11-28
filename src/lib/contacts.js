// src/lib/contacts.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const PROFILE_COLUMNS = "id, username, display_name, avatar_url";

async function requireUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Not authenticated");
  }

  return user.id;
}

export async function searchUsers(query) {
  const search = query
    .trim()
    .replace(/[%_,()."\\]/g, "")
    .trim();

  if (search.length < 2) return [];

  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .or(
      `username.ilike.%${search}%,display_name.ilike.%${search}%`
    )
    .neq("id", userId)
    .limit(20);

  if (error) throw error;

  return data ?? [];
}

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

  return (data ?? [])
    .filter((contact) => contact.profiles)
    .map(({ id, profiles }) => ({
      ...profiles,
      relationId: id,
    }));
}

export async function addContact(contactId) {
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

export async function removeContact(contactId) {
  const userId = await requireUserId();

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("user_id", userId)
    .eq("contact_id", contactId);

  if (error) throw error;
}