// src/components/UserSearch.jsx

"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { searchUsers } from "@/lib/contacts";
import useContactStore from "@/store/useContactStore";
import ContactCard from "./ContactCard";

const EMPTY_RESULTS = [];
const SEARCH_DELAY = 300;
const MIN_QUERY_LENGTH = 2;

export default function UserSearch() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  const contacts = useContactStore((s) => s.contacts);
  const add = useContactStore((s) => s.add);
  const remove = useContactStore((s) => s.remove);

  const searchQuery = query.trim();
  const canSearch = searchQuery.length >= MIN_QUERY_LENGTH;
  const currentSearch = canSearch && search?.query === searchQuery
    ? search
    : null;

  const results = currentSearch?.results ?? EMPTY_RESULTS;
  const searchError = currentSearch?.error ?? "";
  const searching = canSearch && !currentSearch;

  useEffect(() => {
    if (!canSearch) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const users = await searchUsers(searchQuery);

        if (!cancelled) {
          setSearch({
            query: searchQuery,
            results: users,
            error: "",
          });
        }
      } catch (error) {
        if (!cancelled) {
          setSearch({
            query: searchQuery,
            results: EMPTY_RESULTS,
            error: error.message || "Unable to search users.",
          });
        }
      }
    }, SEARCH_DELAY);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, canSearch]);

  function handleQueryChange(event) {
    const value = event.target.value;

    if (value.trim() !== searchQuery) {
      setSearch(null);
    }

    setQuery(value);
  }

  async function handleAction(id, isContact) {
    setPendingId(id);

    try {
      await (isContact ? remove(id) : add(id));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="relative">
        <Search
          size={20}
          aria-hidden="true"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />

        <input
          type="search"
          aria-label="Search users"
          placeholder="Search users..."
          value={query}
          onChange={handleQueryChange}
          className="w-full rounded-xl border border-border bg-input py-3 pl-12 pr-4 text-foreground placeholder:text-muted focus:border-accent"
        />
      </div>

      {searching && (
        <p role="status" className="text-sm text-muted">
          Searching...
        </p>
      )}

      {searchError && (
        <p role="alert" className="text-sm text-red-400">
          {searchError}
        </p>
      )}

      <div className="space-y-3">
        {results.map((user) => {
          const isContact = contacts.some(
            (contact) => contact.id === user.id
          );

          return (
            <ContactCard
              key={user.id}
              user={user}
              isContact={isContact}
              disabled={pendingId !== null}
              onAdd={(id) => handleAction(id, false)}
              onRemove={(id) => handleAction(id, true)}
            />
          );
        })}
      </div>

      {canSearch &&
        !searching &&
        !searchError &&
        results.length === 0 && (
          <p className="text-sm text-muted">
            No users found.
          </p>
        )}
    </section>
  );
}