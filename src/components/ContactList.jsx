// src/components/ContactList.jsx

"use client";

import { useState } from "react";
import useContactStore from "@/store/useContactStore";
import ContactCard from "./ContactCard";

export default function ContactList() {
  const contacts = useContactStore((s) => s.contacts);
  const loading = useContactStore((s) => s.loading);
  const remove = useContactStore((s) => s.remove);

  const [pendingId, setPendingId] = useState(null);

  async function handleRemove(id) {
    setPendingId(id);

    try {
      await remove(id);
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return <p className="text-gray-400">Loading contacts...</p>;
  }

  if (contacts.length === 0) {
    return (
      <p className="text-gray-400">
        You haven't added any contacts yet.
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
          disabled={pendingId !== null}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
}
