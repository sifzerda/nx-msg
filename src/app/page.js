// src/app/page.js

import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";

export default async function HomePage() {
  const user = await getAuthUser();

  redirect(user ? "/messages" : "/login");
}