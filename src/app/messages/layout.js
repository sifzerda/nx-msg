// src/app/messages/layout.js
// a reusable layout containing the conversation sidebar.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MessengerLayout from "@/components/MessengerLayout";

export default async function MessagesLayout({
  children,
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <MessengerLayout userId={user.id}>
      {children}
    </MessengerLayout>
  );
}
