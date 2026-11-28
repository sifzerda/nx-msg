// src/app/forgot-password/page.js

import AuthForm from "@/components/AuthForm";

export const metadata = {
  title: "Forgot Password | Messenger",
};

export default async function ForgotPasswordPage({
  searchParams,
}) {
  const params = await searchParams;

  return (
    <AuthForm
      mode="forgot"
      recoveryError={
        params?.error === "invalid_recovery"
      }
    />
  );
}
