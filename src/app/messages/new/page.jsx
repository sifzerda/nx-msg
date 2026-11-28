// src/app/messages/new/page.jsx

"use client";

import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { LoaderCircle, RotateCw } from "lucide-react";

import NewGroup from "@/components/NewGroup";
import useContactStore from "@/store/useContactStore";

function fetchContacts(force = false) {
  void useContactStore
    .getState()
    .fetchContacts({ force });
}

export default function NewGroupPage() {
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

  useEffect(() => {
    fetchContacts();
  }, []);

  const profiles = useMemo(
    () => contacts.map(
      (contact) => contact.profile ?? contact
    ),
    [contacts]
  );

  if (loading && !contacts.length) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 p-6 text-gray-400"
      >
        <LoaderCircle
          size={20}
          className="animate-spin"
        />

        Loading contacts...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-950">
      {error && (
        <div
          role="alert"
          className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-400"
        >
          <span>{error}</span>

          <button
            type="button"
            disabled={loading}
            onClick={() => fetchContacts(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-gray-200 hover:bg-gray-700 disabled:opacity-50"
          >
            <RotateCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />

            Retry
          </button>
        </div>
      )}

      {(!error || contacts.length > 0) && (
        <NewGroup contacts={profiles} />
      )}
    </div>
  );
}