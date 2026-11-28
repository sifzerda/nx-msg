// src/app/messages/layout.js
// a reusable layout containing the conversation sidebar.

import { requireUser } from "@/lib/supabase/server";
import MessengerLayout from "@/components/MessengerLayout";

export default async function MessagesLayout({ children }) {
  const user = await requireUser();

  return (
    <MessengerLayout
      key={user.id}
      userId={user.id}
    >
      {children}
    </MessengerLayout>
  );
}