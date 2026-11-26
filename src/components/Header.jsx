// src/components/Header.jsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  MessageCircle,
  Users,
  LogOut,
  LogIn,
  UserPlus,
  Settings,
  LoaderCircle,
} from "lucide-react";
import { logout } from "../lib/logout";

/* -------------------- NAVIGATION -------------------- */

const authenticatedLinks = [
  {
    href: "/messages",
    label: "Messages",
    icon: MessageCircle,
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: Users,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
  },
];

const guestLinks = [
  {
    href: "/login",
    label: "Login",
    icon: LogIn,
  },
  {
    href: "/register",
    label: "Register",
    icon: UserPlus,
  },
];

/* -------------------- COMPONENT -------------------- */

export default function Header({ user = null }) {
  const pathname = usePathname();
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);

  const isAuthenticated = Boolean(user);

  const links = isAuthenticated
    ? authenticatedLinks
    : guestLinks;

  /* -------------------- LOGOUT -------------------- */

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const result = await logout();

      if (result.pushCleanupError) {
        console.warn(
          "Logout completed, but push cleanup had an error:",
          result.pushCleanupError
        );
      }

      router.replace("/login");
      router.refresh();

    } catch (error) {
      console.error("Logout failed:", error);

      alert(
        error.message || "Could not log out"
      );

    } finally {
      setLoggingOut(false);
    }
  }

  /* -------------------- RENDER -------------------- */

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-800 bg-gray-900 px-3 sm:gap-4 sm:px-4 md:px-6">

      {/* Logo */}

      <Link
        href={isAuthenticated ? "/messages" : "/login"}
        aria-label="Messenger home"
        className="flex shrink-0 items-center gap-2 text-lg font-bold text-white"
      >
        <MessageCircle
          size={24}
          className="text-blue-400"
        />

        <span className="hidden lg:inline">
          Messenger
        </span>
      </Link>

      {/* Navigation */}

      <nav
        aria-label="Main navigation"
        className="flex min-w-0 items-center gap-1"
      >
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={[
                "flex shrink-0 items-center gap-2",
                "rounded-lg px-3 py-2 text-sm",
                "transition-colors",

                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white",
              ].join(" ")}
            >
              <Icon
                size={18}
                className="shrink-0"
              />

              <span className="hidden md:inline">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Authenticated user */}

      {isAuthenticated && (
        <div className="flex min-w-0 items-center gap-3">

          {/* User information */}

          <div className="hidden min-w-0 text-right lg:block">

            <p className="max-w-40 truncate text-sm font-medium text-white">
              {user.display_name || "User"}
            </p>

            <p className="max-w-40 truncate text-xs text-gray-400">
              @{user.username || "unknown"}
            </p>

          </div>

          {/* Logout */}

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title={loggingOut ? "Logging out..." : "Log out"}
            aria-label={loggingOut ? "Logging out" : "Log out"}
            aria-busy={loggingOut}
            className={[
              "flex shrink-0 items-center gap-2",
              "rounded-lg border border-gray-700",
              "px-3 py-2 text-sm text-gray-300",
              "transition-colors",
              "hover:border-red-500 hover:bg-red-500/10",
              "hover:text-red-400",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
          >
            {loggingOut ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <LogOut size={18} />
            )}

            <span className="hidden lg:inline">
              {loggingOut
                ? "Logging out..."
                : "Logout"}
            </span>

          </button>

        </div>
      )}

    </header>
  );
}