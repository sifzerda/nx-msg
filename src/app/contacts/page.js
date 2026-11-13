// src/app/contacts/page.js

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import ContactsPage from "@/components/ContactsPage";

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return <ContactsPage />;
}
