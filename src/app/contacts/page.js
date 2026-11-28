// src/app/contacts/page.js

import { requireUser } from "@/lib/supabase/server";
import ContactsPage from "@/components/ContactsPage";

export default async function Page() {
  await requireUser();

  return <ContactsPage />;
}