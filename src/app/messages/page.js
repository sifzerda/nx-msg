// src/app/messages/page.js

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import Link from "next/link";
import { Users } from "lucide-react";

export default async function MessagesPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-gray-950 p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold">Messages</h1>
            <p className="mt-2 text-gray-400">
              Logged in as {user.email}
            </p>
          </div>

          <Link
            href="/contacts"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
          >
            <Users size={18} />
            Contacts
          </Link>

          <LogoutButton />
        </header>

        <section className="py-16 text-center">
          <h2 className="text-2xl font-semibold">
            Welcome to Social Messenger
          </h2>

          <p className="mt-3 text-gray-400">
            Your conversations will appear here.
          </p>
        </section>
      </div>
    </main>
  );
}
