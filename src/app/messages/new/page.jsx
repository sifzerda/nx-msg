// src/app/messages/new/page.jsx

"use client";

import { useEffect } from "react";
import NewGroup from "@/components/NewGroup";
import useContactStore from "@/store/useContactStore";

export default function NewGroupPage() {
  const contacts = useContactStore((s) => s.contacts);
  const loading = useContactStore((s) => s.loading);
  const fetchContacts = useContactStore(
    (s) => s.fetchContacts
  );

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  if (loading) {
    return (
      <p className="p-6 text-gray-400">
        Loading contacts...
      </p>
    );
  }

  // NewGroup expects profile objects:
  // { id, username, display_name }
  // Adapt this mapping if your contact store uses
  // a nested profile structure.
  const profiles = contacts.map((contact) =>
    contact.profile ?? contact
  );

  return (
    <div className="h-full overflow-y-auto bg-gray-950">
      <NewGroup contacts={profiles} />
    </div>
  );
}
