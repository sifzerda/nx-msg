// src/components/AuthForm.jsx

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

import {
  logout,
  notifySessionChange,
  redirectAfterAuth,
} from "@/lib/logout";

const MIN_PASSWORD_LENGTH = 6;

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-white outline-none focus:border-blue-500 disabled:opacity-50";

const FORM_CONFIG = {
  login: {
    title: "Welcome Back",
    submitLabel: "Log In",
    loadingLabel: "Logging in...",
    email: true,
    password: true,
    passwordAutoComplete: "current-password",
    alternateText: "Don't have an account?",
    alternateHref: "/register",
    alternateLabel: "Register",
  },

  register: {
    title: "Create Account",
    submitLabel: "Register",
    loadingLabel: "Creating account...",
    email: true,
    password: true,
    confirmPassword: true,
    passwordAutoComplete: "new-password",
    alternateText: "Already registered?",
    alternateHref: "/login",
    alternateLabel: "Log in",
  },

  forgot: {
    title: "Forgot Password",
    description:
      "Enter your email address to receive a password recovery link.",
    submitLabel: "Send Recovery Email",
    loadingLabel: "Sending email...",
    email: true,
    alternateText: "Remember your password?",
    alternateHref: "/login",
    alternateLabel: "Log in",
  },

  reset: {
    title: "Reset Password",
    description:
      "Choose a new password for your account.",
    submitLabel: "Update Password",
    loadingLabel: "Updating password...",
    password: true,
    confirmPassword: true,
    passwordAutoComplete: "new-password",
    alternateText: "Need another recovery link?",
    alternateHref: "/forgot-password",
    alternateLabel: "Request one",
  },
};

const SUCCESS_CLASS =
  "rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400";

/* -------------------- SHARED INPUT -------------------- */

function AuthInput({
  name,
  label,
  type = "text",
  autoComplete,
  minLength,
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={name}
        className="text-sm text-gray-300"
      >
        {label}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        placeholder={label}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        className={INPUT_CLASS}
      />
    </div>
  );
}

/* -------------------- AUTH FORM -------------------- */

export default function AuthForm({
  mode = "login",
  registered = false,
  passwordReset = false,
  recoveryError = false,
  recoveryUserId = null,
}) {
  const config = FORM_CONFIG[mode];

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  const submittingRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordUpdated, setPasswordUpdated] =
    useState(false);

  /* -------------------- SUBMISSION -------------------- */

  async function handleSubmit(event) {
    event.preventDefault();

    if (submittingRef.current) return;

    const formData = new FormData(
      event.currentTarget
    );

    const email = String(
      formData.get("email") ?? ""
    ).trim();

    const password = String(
      formData.get("password") ?? ""
    );

    const confirmPassword = String(
      formData.get("confirmPassword") ?? ""
    );

    setError("");
    setSuccess("");

    if (config.email && !email) {
      setError("Email address is required.");
      return;
    }

    if (
      config.password &&
      !password &&
      !passwordUpdated
    ) {
      setError("Password is required.");
      return;
    }

    if (
      config.confirmPassword &&
      !passwordUpdated
    ) {
      if (
        password.length < MIN_PASSWORD_LENGTH
      ) {
        setError(
          `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`
        );

        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    submittingRef.current = true;
    setLoading(true);

    let navigating = false;

    try {
      const supabase = createClient();

      /* -------------------- FORGOT PASSWORD -------------------- */

      if (isForgot) {
        const { error: authError } =
          await supabase.auth.resetPasswordForEmail(
            email,
            {
              redirectTo: new URL(
                "/auth/confirm",
                window.location.origin
              ).href,
            }
          );

        if (authError) {
          if (authError.status === 429) {
            throw new Error(
              "Too many recovery requests. Please try again later."
            );
          }

          // Do not reveal whether an account exists.
          if (
            authError.code !== "user_not_found"
          ) {
            throw new Error(
              "Unable to process the recovery request. Please try again later."
            );
          }
        }

        setSuccess(
          "If an account exists for this email address, you will receive a password recovery link. Please check your inbox and spam folder."
        );

        return;
      }

      /* -------------------- RESET PASSWORD -------------------- */

      if (isReset) {
        if (!passwordUpdated) {
          const { data, error: userError } =
            await supabase.auth.getUser();

          if (
            userError ||
            !data.user ||
            data.user.id !== recoveryUserId
          ) {
            throw new Error(
              "Your recovery session is invalid or has expired. Please request a new recovery link."
            );
          }

          const { error: authError } =
            await supabase.auth.updateUser({
              password,
            });

          if (authError) throw authError;

          setPasswordUpdated(true);
        }

        // Reuse existing application and push cleanup.
        await logout();

        redirectAfterAuth("/login?passwordReset=true");

        navigating = true;

        return;
      }

      /* -------------------- LOGIN / REGISTER -------------------- */

      const credentials = {
        email,
        password,
      };

      const { data, error: authError } =
        isRegister
          ? await supabase.auth.signUp(
            credentials
          )
          : await supabase.auth.signInWithPassword(
            credentials
          );

      if (authError) {
        throw authError;
      }

      if (isLogin && !data.session) {
        throw new Error(
          "Unable to establish an authenticated session."
        );
      }

      const destination =
        isRegister && !data.session
          ? "/login?registered=true"
          : "/messages";

      if (data.session) {
        notifySessionChange();
      }

      redirectAfterAuth(destination);

      navigating = true;
    } catch (error) {
      setError(
        error?.message ||
        "Authentication failed. Please try again."
      );
    } finally {
      if (!navigating) {
        submittingRef.current = false;
        setLoading(false);
      }
    }
  }

  /* -------------------- RENDER -------------------- */

  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-gray-950 px-4 py-6">
      <form
        onSubmit={handleSubmit}
        aria-busy={loading}
        className="my-auto w-full max-w-md space-y-5 rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8"
      >
        <h1 className="text-center text-3xl font-bold text-white">
          {config.title}
        </h1>

        {config.description && (
          <p className="text-center text-sm leading-relaxed text-gray-400">
            {config.description}
          </p>
        )}

        {isLogin && registered && (
          <p
            role="status"
            className={SUCCESS_CLASS}
          >
            Registration submitted. Check your
            email for a confirmation link before
            logging in.
          </p>
        )}

        {isLogin && passwordReset && (
          <p
            role="status"
            className={SUCCESS_CLASS}
          >
            Your password has been updated
            successfully. Log in using your new
            password.
          </p>
        )}

        {isForgot && recoveryError && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
          >
            The recovery link is invalid or has
            expired. Please request a new one.
          </p>
        )}

        {success && (
          <p
            role="status"
            className={SUCCESS_CLASS}
          >
            {success}
          </p>
        )}

        {passwordUpdated ? (
          <p
            role="status"
            className={SUCCESS_CLASS}
          >
            Password updated. Finish signing out
            before logging in again.
          </p>
        ) : (
          <fieldset
            disabled={loading}
            className="min-w-0 space-y-4"
          >
            {config.email && (
              <AuthInput
                name="email"
                label="Email address"
                type="email"
                autoComplete="email"
              />
            )}

            {config.password && (
              <AuthInput
                name="password"
                label={
                  isReset
                    ? "New password"
                    : "Password"
                }
                type="password"
                autoComplete={
                  config.passwordAutoComplete
                }
                minLength={
                  config.confirmPassword
                    ? MIN_PASSWORD_LENGTH
                    : undefined
                }
              />
            )}

            {config.confirmPassword && (
              <AuthInput
                name="confirmPassword"
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
              />
            )}

            {isLogin && (
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  prefetch={false}
                  className="text-sm text-blue-400 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}
          </fieldset>
        )}

        {error && (
          <p
            role="alert"
            className="text-sm text-red-400"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 p-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && (
            <LoaderCircle
              size={18}
              className="animate-spin"
              aria-hidden="true"
            />
          )}

          {loading
            ? config.loadingLabel
            : passwordUpdated
              ? "Return to login"
              : config.submitLabel}
        </button>

        <p className="text-center text-sm text-gray-400">
          {config.alternateText}{" "}

          <Link
            href={config.alternateHref}
            prefetch={false}
            className="text-blue-400 hover:underline"
          >
            {config.alternateLabel}
          </Link>
        </p>
      </form>
    </div>
  );
}