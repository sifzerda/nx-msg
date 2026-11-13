// src/components/UserSearch.jsx

"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { searchUsers } from "@/lib/contacts";
import useContactStore from "@/store/useContactStore";
import ContactCard from "./ContactCard";

export default function UserSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [pendingId, setPendingId] = useState(null);

  const contacts = useContactStore((s) => s.contacts);
  const add = useContactStore((s) => s.add);
  const remove = useContactStore((s) => s.remove);

  useEffect(() => {
    let cancelled = false;

    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");

      try {
        const users = await searchUsers(query);

        if (!cancelled) {
          setResults(users);
        }
      } catch (error) {
        if (!cancelled) {
          setSearchError(error.message);
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function handleAction(id, isContact) {
    setPendingId(id);

    try {
      if (isContact) {
        await remove(id);
      } else {
        await add(id);
      }
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="relative">
        <Search
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
        />

        <input
          type="search"
          placeholder="Search users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-800 bg-gray-900 py-3 pl-12 pr-4 text-white outline-none focus:border-blue-500"
        />
      </div>

      {searching && (
        <p className="text-sm text-gray-400">Searching...</p>
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

      {!searching &&
        !searchError &&
        query.trim().length >= 2 &&
        results.length === 0 && (
          <p className="text-sm text-gray-400">
            No users found.
          </p>
        )}
    </section>
  );
}
