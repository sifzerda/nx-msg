// src/components/Header.jsx

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  MessageCircle,
  Users,
  LogOut,
  LogIn,
  UserPlus,
  Settings,
  LoaderCircle,
} from "lucide-react";

import { logout } from "@/lib/logout";

const AUTHENTICATED_LINKS = [
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

const GUEST_LINKS = [
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

const NAV_LINK_CLASS =
  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors";

export default function Header({ user = null }) {
  const pathname = usePathname() ?? "";

  const logoutRef = useRef(false);

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [error, setError] = useState("");

  const links = user
    ? AUTHENTICATED_LINKS
    : GUEST_LINKS;

  async function handleLogout() {
    if (logoutRef.current) return;

    logoutRef.current = true;

    setLoggingOut(true);
    setError("");

    let navigating = false;

    try {
      const result = await logout();

      if (result.pushCleanupError) {
        console.warn(
          "Push cleanup failed:",
          result.pushCleanupError
        );
      }

      window.location.replace("/login");

      navigating = true;
    } catch (error) {
      console.error("Logout failed:", error);

      setError(
        error?.message || "Could not log out."
      );
    } finally {
      if (!navigating) {
        logoutRef.current = false;
        setLoggingOut(false);
      }
    }
  }

  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between gap-2 border-b border-gray-800 bg-gray-900 px-3 sm:gap-4 sm:px-4 md:px-6">
      <Link
        href={user ? "/messages" : "/login"}
        prefetch={false}
        aria-label="Messenger home"
        className="flex shrink-0 items-center gap-2 text-lg font-bold text-white"
      >
        <MessageCircle
          size={24}
          className="text-blue-400"
          aria-hidden="true"
        />

        <span className="hidden lg:inline">
          Messenger
        </span>
      </Link>

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
              prefetch={false}
              title={label}
              aria-label={label}
              aria-current={
                active ? "page" : undefined
              }
              className={`${NAV_LINK_CLASS} ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon
                size={18}
                className="shrink-0"
                aria-hidden="true"
              />

              <span className="hidden md:inline">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden min-w-0 text-right lg:block">
            <p className="max-w-40 truncate text-sm font-medium text-white">
              {user.display_name || "User"}
            </p>

            <p className="max-w-40 truncate text-xs text-gray-400">
              @{user.username || "unknown"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title={
              loggingOut
                ? "Logging out..."
                : "Log out"
            }
            aria-label={
              loggingOut
                ? "Logging out"
                : "Log out"
            }
            aria-busy={loggingOut}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-red-500 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingOut ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <LogOut
                size={18}
                aria-hidden="true"
              />
            )}

            <span className="hidden lg:inline">
              {loggingOut
                ? "Logging out..."
                : "Logout"}
            </span>
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="absolute right-3 top-full z-50 mt-2 max-w-sm rounded-lg border border-red-500/30 bg-gray-900 p-3 text-sm text-red-400 shadow-lg"
        >
          {error}
        </div>
      )}
    </header>
  );
}