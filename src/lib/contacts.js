// src/lib/contacts.js

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export async function searchUsers(query) {
  const search = query.trim();

  if (search.length < 2) return [];

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .or(
      `username.ilike.%${search.replace(/[%_,().]/g, "")}%,display_name.ilike.%${search.replace(/[%_,().]/g, "")}%`
    )
    .neq("id", user.id)
    .limit(20);

  if (error) throw error;

  return data ?? [];
}

export async function getContacts() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("contacts")
    .select(`
      id,
      contact_id,
      profiles!contacts_contact_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((contact) => ({
    ...contact.profiles,
    relationId: contact.id,
  }));
}

export async function addContact(contactId) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  if (user.id === contactId) {
    throw new Error("You cannot add yourself");
  }

  const { error } = await supabase
    .from("contacts")
    .insert({
      user_id: user.id,
      contact_id: contactId,
    });

  if (error) throw error;
}

export async function removeContact(contactId) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("user_id", user.id)
    .eq("contact_id", contactId);

  if (error) throw error;
}
