// src/app/login/page.js

import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";

export const metadata = {
  title: "Login | Messenger",
};

export default async function LoginPage({
  searchParams,
}) {
  const user = await getAuthUser();

  if (user) {
    redirect("/messages");
  }

  const params = await searchParams;

  return (
    <AuthForm
      mode="login"
      registered={params?.registered === "true"}
    />
  );
}