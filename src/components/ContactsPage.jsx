// src/components/ContactsPage.jsx

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

import useContactStore from "@/store/useContactStore";
import UserSearch from "./UserSearch";
import ContactList from "./ContactList";

export default function ContactsPage() {
  const fetchContacts = useContactStore((s) => s.fetchContacts);
  const error = useContactStore((s) => s.error);
  const reset = useContactStore((s) => s.reset);

  useEffect(() => {
    fetchContacts();

    return () => reset();
  }, [fetchContacts, reset]);

  return (
    <main className="min-h-screen bg-gray-950 p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-center gap-4">
          <Link
            href="/messages"
            className="rounded-lg bg-gray-800 p-3 hover:bg-gray-700"
          >
            <ArrowLeft size={20} />
          </Link>

          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold">
              <Users className="text-blue-400" />
              Contacts
            </h1>

            <p className="mt-1 text-gray-400">
              Find people and manage your contacts.
            </p>
          </div>
        </header>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-800 bg-red-950 p-3 text-red-300"
          >
            {error}
          </p>
        )}

        <div className="grid gap-8 md:grid-cols-2">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              Find People
            </h2>

            <UserSearch />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              My Contacts
            </h2>

            <ContactList />
          </section>
        </div>
      </div>
    </main>
  );
}
