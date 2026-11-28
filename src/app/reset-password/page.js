// src/app/reset-password/page.js

import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";

export const metadata = {
  title: "Reset Password | Messenger",
};

export default async function ResetPasswordPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect(
      "/forgot-password?error=invalid_recovery"
    );
  }

  return (
    <AuthForm
      mode="reset"
      recoveryUserId={user.id}
    />
  );
}