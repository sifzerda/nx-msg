// src/components/NewGroup.jsx

"use client";

import {
  memo,
  useMemo,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  Check,
  Users,
  LoaderCircle,
} from "lucide-react";

import { createGroupChat } from "@/lib/messages";
import useChatStore from "@/store/useChatStore";

const EMPTY_CONTACTS = Object.freeze([]);

const MIN_CONTACTS = 2;
const MAX_CONTACTS = 49;
const MAX_NAME_LENGTH = 100;

/* -------------------- CONTACT OPTION -------------------- */

const ContactOption = memo(function ContactOption({
  contact,
  checked,
  disabled,
  onToggle,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(contact.id)}
      aria-pressed={checked}
      className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? "border-blue-500 bg-blue-500/10"
          : "border-gray-800 bg-gray-900 hover:bg-gray-800"
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">
          {contact.display_name ||
            contact.username ||
            "Unknown user"}
        </p>

        {contact.username && (
          <p className="truncate text-xs text-gray-400">
            @{contact.username}
          </p>
        )}
      </div>

      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
          checked
            ? "border-blue-500 bg-blue-600"
            : "border-gray-600"
        }`}
      >
        {checked && (
          <Check size={16} className="text-white" />
        )}
      </span>
    </button>
  );
});

/* -------------------- NEW GROUP -------------------- */

export default function NewGroup({
  contacts = EMPTY_CONTACTS,
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [selected, setSelected] = useState(
    () => new Set()
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submittingRef = useRef(false);
  const createdGroupRef = useRef(null);

  const contactIds = useMemo(
    () => new Set(contacts.map((contact) => contact.id)),
    [contacts]
  );

  // Ignore contacts removed after being selected.

  const selectedIds = useMemo(
    () => [...selected].filter((id) => contactIds.has(id)),
    [selected, contactIds]
  );

  const selectedCount = selectedIds.length;
  const groupName = name.trim();

  const canSubmit =
    !loading &&
    groupName.length > 0 &&
    groupName.length <= MAX_NAME_LENGTH &&
    selectedCount >= MIN_CONTACTS &&
    selectedCount <= MAX_CONTACTS;

const toggleContact = useCallback((id) => {
  if (
    submittingRef.current ||
    createdGroupRef.current ||
    !contactIds.has(id)
  ) {
    return;
  }

  setSelected((current) => {
    const next = new Set(
      [...current].filter(
        (item) => contactIds.has(item)
      )
    );

    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= MAX_CONTACTS) {
        return current;
      }

      next.add(id);
    }

    return next;
  });
}, [contactIds]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (submittingRef.current) return;

    // If creation succeeded previously, do not create
    // another group merely because navigation failed.

    if (createdGroupRef.current) {
      router.push(
        `/messages/${createdGroupRef.current}`
      );

      return;
    }

    setError("");

    if (!groupName) {
      setError("Enter a group name.");
      return;
    }

    if (groupName.length > MAX_NAME_LENGTH) {
      setError(
        `Group names cannot exceed ${MAX_NAME_LENGTH} characters.`
      );

      return;
    }

    if (selectedCount < MIN_CONTACTS) {
      setError(
        `Select at least ${MIN_CONTACTS} contacts.`
      );

      return;
    }

    if (selectedCount > MAX_CONTACTS) {
      setError(
        `Select no more than ${MAX_CONTACTS} contacts.`
      );

      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      const conversationId = await createGroupChat(
        groupName,
        selectedIds
      );

      if (!conversationId) {
        throw new Error(
          "The server did not return a conversation ID."
        );
      }

      createdGroupRef.current = conversationId;

      // Refresh the sidebar without delaying navigation.

      void useChatStore
        .getState()
        .fetchConversations({ force: true })
        .catch((error) => {
          console.error(
            "Unable to refresh conversations:",
            error
          );
        });

      router.push(`/messages/${conversationId}`);
    } catch (error) {
      setError(
        error?.message || "Could not create group."
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={loading}
      className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 sm:p-6"
    >
      <header className="flex items-center gap-3">
        <Users
          size={28}
          className="shrink-0 text-blue-400"
        />

        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-white">
            New Group
          </h1>

          <p className="text-sm text-gray-400">
            Create a conversation with your contacts
          </p>
        </div>
      </header>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="group-name"
            className="text-sm text-gray-300"
          >
            Group name
          </label>

          <span className="text-xs tabular-nums text-gray-500">
            {name.length}/{MAX_NAME_LENGTH}
          </span>
        </div>

        <input
          id="group-name"
          value={name}
          disabled={loading}
          onChange={(event) =>
            setName(event.target.value)
          }
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Weekend Plans"
          autoComplete="off"
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </div>

      <fieldset disabled={loading}>
        <legend className="mb-3 w-full text-sm text-gray-300">
          <span className="flex items-center justify-between gap-2">
            Select contacts

            <span className="tabular-nums text-gray-400">
              {selectedCount}/{MAX_CONTACTS}
            </span>
          </span>
        </legend>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {contacts.map((contact) => {
            const checked = selected.has(contact.id);

            return (
              <ContactOption
                key={contact.id}
                contact={contact}
                checked={checked}
                disabled={
                  loading ||
                  (!checked &&
                    selectedCount >= MAX_CONTACTS)
                }
                onToggle={toggleContact}
              />
            );
          })}

          {!contacts.length && (
            <p className="text-sm text-gray-500">
              Add some contacts before creating a group.
            </p>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Select between {MIN_CONTACTS} and{" "}
          {MAX_CONTACTS} contacts.
        </p>
      </fieldset>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-950/30 p-3 text-sm text-red-400"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && (
          <LoaderCircle
            size={18}
            className="animate-spin"
          />
        )}

        {loading ? "Creating..." : "Create Group"}
      </button>
    </form>
  );
}