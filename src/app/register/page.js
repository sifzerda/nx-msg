// src/app/register/page.js

import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";

export const metadata = {
  title: "Register | Messenger",
};

export default async function RegisterPage() {
  const user = await getAuthUser();

  if (user) {
    redirect("/messages");
  }

  return <AuthForm mode="register" />;
}