// src/components/ContactsPage.jsx

"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";

import {
  ArrowLeft,
  Users,
  UserRound,
  UserPlus,
  UserMinus,
  MessageCircle,
  Search,
  LoaderCircle,
} from "lucide-react";

import useContactStore from "@/store/useContactStore";
import { searchUsers } from "@/lib/contacts";
import { startChat } from "@/lib/messages";

/* -------------------- CONSTANTS -------------------- */

const EMPTY_RESULTS = Object.freeze([]);

const SEARCH_DELAY = 300;
const MIN_QUERY_LENGTH = 2;

const SEARCH_CACHE_TTL = 60_000;
const MAX_SEARCH_CACHE_ENTRIES = 20;

const BUTTON_CLASS =
  "flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/* -------------------- SEARCH HOOK -------------------- */

function useUserSearch() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState(null);

  const cacheRef = useRef(new Map());

  const searchQuery = query.trim();

  const canSearch =
    searchQuery.length >= MIN_QUERY_LENGTH;

  const currentSearch =
    canSearch && search?.query === searchQuery
      ? search
      : null;

  useEffect(() => {
    if (!canSearch) return;

    let active = true;

    const cache = cacheRef.current;

    const timer = setTimeout(async () => {
      try {
        const cached = cache.get(searchQuery);

        if (
          cached &&
          cached.expiresAt > Date.now()
        ) {
          // Move recently accessed entries to the end.
          cache.delete(searchQuery);
          cache.set(searchQuery, cached);

          if (active) {
            setSearch({
              query: searchQuery,
              results: cached.results,
              error: "",
            });
          }

          return;
        }

        cache.delete(searchQuery);

        const results = await searchUsers(searchQuery);

        if (!active) return;

        cache.set(searchQuery, {
          results,
          expiresAt: Date.now() + SEARCH_CACHE_TTL,
        });

        while (cache.size > MAX_SEARCH_CACHE_ENTRIES) {
          const oldestKey = cache.keys().next().value;
          cache.delete(oldestKey);
        }

        setSearch({
          query: searchQuery,
          results,
          error: "",
        });
      } catch (error) {
        if (!active) return;

        setSearch({
          query: searchQuery,
          results: EMPTY_RESULTS,
          error:
            error?.message || "Unable to search users.",
        });
      }
    }, SEARCH_DELAY);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, canSearch]);

  function changeQuery(value) {
    if (value.trim() !== searchQuery) {
      setSearch(null);
    }

    setQuery(value);
  }

  return {
    query,
    changeQuery,
    canSearch,
    results: currentSearch?.results ?? EMPTY_RESULTS,
    error: currentSearch?.error ?? "",
    searching: canSearch && !currentSearch,
  };
}

/* -------------------- CONTACT CARD -------------------- */

const ContactCard = memo(function ContactCard({
  user,
  isContact = false,
  pending,
  onAction,
}) {
  const disabled = Boolean(pending);

  const isPending = pending?.id === user.id;

  const adding =
    isPending && pending.action === "add";

  const removing =
    isPending && pending.action === "remove";

  const opening =
    isPending && pending.action === "message";

  const name =
    user.display_name ||
    user.username ||
    "Unknown user";

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-800">
          <UserRound
            size={22}
            className="text-gray-400"
          />
        </div>

        <div className="min-w-0">
          <h3 className="truncate font-semibold text-white">
            {name}
          </h3>

          {user.username && (
            <p className="truncate text-sm text-gray-400">
              @{user.username}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isContact ? (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onAction(user.id, "message")
              }
              aria-label={`Message ${name}`}
              title={`Message ${name}`}
              className={`${BUTTON_CLASS} bg-blue-600 text-white hover:bg-blue-500`}
            >
              {opening ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <MessageCircle size={16} />
              )}

              <span className="hidden sm:inline">
                {opening ? "Opening..." : "Message"}
              </span>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onAction(user.id, "remove")
              }
              aria-label={`Remove ${name}`}
              title={`Remove ${name}`}
              className={`${BUTTON_CLASS} bg-red-600/15 text-red-400 hover:bg-red-600/25`}
            >
              {removing ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <UserMinus size={16} />
              )}

              <span className="hidden sm:inline">
                {removing ? "Removing..." : "Remove"}
              </span>
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onAction(user.id, "add")
            }
            aria-label={`Add ${name}`}
            className={`${BUTTON_CLASS} bg-blue-600 text-white hover:bg-blue-500`}
          >
            {adding ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            ) : (
              <UserPlus size={16} />
            )}

            {adding ? "Adding..." : "Add"}
          </button>
        )}
      </div>
    </div>
  );
});

/* -------------------- CONTACT LIST -------------------- */

const ContactList = memo(function ContactList({
  contacts,
  loading,
  pending,
  onAction,
}) {
  if (loading && !contacts.length) {
    return (
      <p role="status" className="text-gray-400">
        Loading contacts...
      </p>
    );
  }

  if (!contacts.length) {
    return (
      <p className="text-gray-400">
        You haven&apos;t added any contacts yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {contacts.map((contact) => (
        <ContactCard
          key={contact.id}
          user={contact}
          isContact
          pending={pending}
          onAction={onAction}
        />
      ))}
    </div>
  );
});

/* -------------------- USER SEARCH -------------------- */

const UserSearch = memo(function UserSearch({
  contactIds,
  pending,
  onAction,
}) {
  const {
    query,
    changeQuery,
    canSearch,
    results,
    error,
    searching,
  } = useUserSearch();

  return (
    <div className="space-y-4">
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
          autoComplete="off"
          value={query}
          onChange={(event) =>
            changeQuery(event.target.value)
          }
          className="w-full rounded-xl border border-border bg-input py-3 pl-12 pr-4 text-foreground placeholder:text-muted focus:border-accent"
        />
      </div>

      {searching && (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-muted"
        >
          <LoaderCircle
            size={16}
            className="animate-spin"
          />

          Searching...
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((user) => (
            <ContactCard
              key={user.id}
              user={user}
              isContact={contactIds.has(user.id)}
              pending={pending}
              onAction={onAction}
            />
          ))}
        </div>
      )}

      {canSearch &&
        !searching &&
        !error &&
        !results.length && (
          <p className="text-sm text-muted">
            No users found.
          </p>
        )}
    </div>
  );
});

/* -------------------- CONTACTS PAGE -------------------- */

export default function ContactsPage() {
  const router = useRouter();

  const {
    contacts,
    loading,
    error,
  } = useContactStore(
    useShallow((state) => ({
      contacts: state.contacts,
      loading: state.loading,
      error: state.error,
    }))
  );

  const [pending, setPending] = useState(null);
  const [actionError, setActionError] = useState(null);

  const pendingRef = useRef(false);
  const mountedRef = useRef(false);

  const contactIds = useMemo(
    () => new Set(
      contacts.map((contact) => contact.id)
    ),
    [contacts]
  );

  useEffect(() => {
    mountedRef.current = true;

    void useContactStore.getState().fetchContacts();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleAction = useCallback(
    async (id, action) => {
      if (!id || pendingRef.current) return;

      if (
        action !== "add" &&
        action !== "remove" &&
        action !== "message"
      ) {
        return;
      }

      pendingRef.current = true;

      setPending({ id, action });
      setActionError(null);

      try {
        if (action === "message") {
          const conversationId = await startChat(id);

          if (!conversationId) {
            throw new Error("Unable to open conversation.");
          }

          if (mountedRef.current) {
            router.push(`/messages/${conversationId}`);
          }

          return;
        }

        const store = useContactStore.getState();

        if (action === "add") {
          await store.add(id);
        } else {
          await store.remove(id);
        }
      } catch (error) {
        if (mountedRef.current) {
          setActionError(
            error?.message || "Unable to complete action."
          );
        }
      } finally {
        pendingRef.current = false;

        if (mountedRef.current) {
          setPending(null);
        }
      }
    },
    [router]
  );

  const visibleError = actionError || error;

  return (
    <div className="min-h-screen bg-gray-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-center gap-4">
          <Link
            href="/messages"
            aria-label="Back to messages"
            className="rounded-lg bg-gray-800 p-3 hover:bg-gray-700"
          >
            <ArrowLeft size={20} />
          </Link>

          <div className="min-w-0">
            <h1 className="flex items-center gap-3 text-3xl font-bold">
              <Users className="shrink-0 text-blue-400" />
              Contacts
            </h1>

            <p className="mt-1 text-gray-400">
              Find people and manage your contacts.
            </p>
          </div>
        </header>

        {visibleError && (
          <p
            role="alert"
            className="rounded-lg border border-red-800 bg-red-950 p-3 text-red-300"
          >
            {visibleError}
          </p>
        )}

        <div className="grid gap-8 md:grid-cols-2">
          <section className="min-w-0 space-y-4">
            <h2 className="text-xl font-semibold">
              Find People
            </h2>

            <UserSearch
              contactIds={contactIds}
              pending={pending}
              onAction={handleAction}
            />
          </section>

          <section className="min-w-0 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">
                My Contacts
              </h2>

              <span className="rounded-full bg-gray-800 px-2.5 py-1 text-xs tabular-nums text-gray-400">
                {contacts.length}
              </span>
            </div>

            <ContactList
              contacts={contacts}
              loading={loading}
              pending={pending}
              onAction={handleAction}
            />
          </section>
        </div>
      </div>
    </div>
  );
}