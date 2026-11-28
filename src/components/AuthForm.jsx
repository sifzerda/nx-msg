// src/components/AuthForm.jsx

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifySessionChange } from "@/lib/logout";

const INPUT_CLASS = "w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-white outline-none focus:border-blue-500 disabled:opacity-50";

const FORM_CONFIG = {
    login: {
        title: "Welcome Back",
        submitLabel: "Log In",
        loadingLabel: "Logging in...",
        passwordAutoComplete: "current-password",
        alternateText: "Don't have an account?",
        alternateHref: "/register",
        alternateLabel: "Register",
    },

    register: {
        title: "Create Account",
        submitLabel: "Register",
        loadingLabel: "Creating account...",
        passwordAutoComplete: "new-password",
        alternateText: "Already registered?",
        alternateHref: "/login",
        alternateLabel: "Log in",
    },
};

export default function AuthForm({
    mode = "login",
    registered = false,
}) {
    const isRegister = mode === "register";
    const config = FORM_CONFIG[mode];

    const submittingRef = useRef(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

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

        if (!email || !password) {
            setError("Email and password are required.");
            return;
        }

        if (isRegister) {
            if (password.length < 6) {
                setError(
                    "Password must contain at least 6 characters."
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

            const credentials = {
                email,
                password,
            };

            const { data, error: authError } =
                isRegister
                    ? await supabase.auth.signUp(credentials)
                    : await supabase.auth.signInWithPassword(
                        credentials
                    );

            if (authError) {
                throw authError;
            }

            if (!isRegister && !data.session) {
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

            window.location.replace(destination);

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

                {!isRegister && registered && (
                    <p
                        role="status"
                        className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400"
                    >
                        Registration submitted. Check your email
                        for a confirmation link before logging in.
                    </p>
                )}

                <fieldset
                    disabled={loading}
                    className="min-w-0 space-y-4"
                >
                    <div className="space-y-2">
                        <label
                            htmlFor="email"
                            className="text-sm text-gray-300"
                        >
                            Email address
                        </label>

                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="Email address"
                            autoComplete="email"
                            required
                            className={INPUT_CLASS}
                        />
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="password"
                            className="text-sm text-gray-300"
                        >
                            Password
                        </label>

                        <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Password"
                            autoComplete={
                                config.passwordAutoComplete
                            }
                            minLength={
                                isRegister ? 6 : undefined
                            }
                            required
                            className={INPUT_CLASS}
                        />
                    </div>

                    {isRegister && (
                        <div className="space-y-2">
                            <label
                                htmlFor="confirmPassword"
                                className="text-sm text-gray-300"
                            >
                                Confirm password
                            </label>

                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                placeholder="Confirm password"
                                autoComplete="new-password"
                                required
                                className={INPUT_CLASS}
                            />
                        </div>
                    )}
                </fieldset>

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