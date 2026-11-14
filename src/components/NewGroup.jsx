// src/components/NewGroup.jsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Users } from "lucide-react";

import { createGroupChat } from "@/lib/messages";
import useChatStore from "@/store/useChatStore";

export default function NewGroup({ contacts = [] }) {
  const router = useRouter();

  const fetchConversations = useChatStore(
    (s) => s.fetchConversations
  );

  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleContact(id) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter a group name");
      return;
    }

    if (selected.length < 2) {
      setError("Select at least two contacts");
      return;
    }

    setLoading(true);

    try {
      const conversationId = await createGroupChat(
        name,
        selected
      );

      await fetchConversations();

      router.push(`/messages/${conversationId}`);
    } catch (err) {
      setError(err.message || "Could not create group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6"
    >
      <div className="flex items-center gap-3">
        <Users className="text-blue-400" size={28} />

        <div>
          <h1 className="text-xl font-semibold text-white">
            New Group
          </h1>

          <p className="text-sm text-gray-400">
            Create a conversation with your contacts
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="group-name"
          className="mb-2 block text-sm text-gray-300"
        >
          Group name
        </label>

        <input
          id="group-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="e.g. Weekend Plans"
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <p className="mb-3 text-sm text-gray-300">
          Select contacts ({selected.length} selected)
        </p>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {contacts.map((contact) => {
            const checked = selected.includes(contact.id);

            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => toggleContact(contact.id)}
                aria-pressed={checked}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
                  checked
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-800 bg-gray-900 hover:bg-gray-800"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {contact.display_name || contact.username}
                  </p>

                  <p className="text-xs text-gray-400">
                    @{contact.username}
                  </p>
                </div>

                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-md border ${
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
          })}

          {contacts.length === 0 && (
            <p className="text-sm text-gray-500">
              Add some contacts before creating a group.
            </p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || selected.length < 2 || !name.trim()}
        className="rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Group"}
      </button>
    </form>
  );
}
