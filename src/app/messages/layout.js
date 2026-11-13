// src/app/messages/layout.js
// a reusable layout containing the conversation sidebar.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatList from "@/components/ChatList";
import LogoutButton from "@/components/LogoutButton";

export default async function MessagesLayout({ children }) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-gray-950 text-white">
      <div className="flex w-72 shrink-0 flex-col border-r border-gray-800">
        <div className="min-h-0 flex-1">
          <ChatList userId={user.id} />
        </div>

        <div className="border-t border-gray-800 bg-gray-900 p-4">
          <LogoutButton />
        </div>
      </div>

      <section className="min-w-0 flex-1">
        {children}
      </section>
    </main>
  );
}

