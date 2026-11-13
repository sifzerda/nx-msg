// src/components/Header.jsx

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageCircle,
  Users,
  LogOut,
  LogIn,
  UserPlus,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import useChatStore from "@/store/useChatStore";
import useContactStore from "@/store/useContactStore";
import usePresenceStore from "@/store/usePresenceStore";

const supabase = createClient();

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

export default function Header({ user = null }) {
  const pathname = usePathname();
  const router = useRouter();

  const isAuthenticated = Boolean(user);

  const links = isAuthenticated
    ? authenticatedLinks
    : guestLinks;

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout failed:", error.message);
      return;
    }

    useChatStore.getState().reset();
    useContactStore.getState().reset();
    usePresenceStore.getState().reset();

    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-gray-800 bg-gray-900 px-4 md:px-6">
      {/* Logo */}
      <Link
        href={isAuthenticated ? "/messages" : "/login"}
        className="flex shrink-0 items-center gap-2 text-lg font-bold text-white"
      >
        <MessageCircle
          size={24}
          className="text-blue-400"
        />

        <span className="hidden sm:inline">
          Messenger
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex items-center gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <Icon size={18} />

              <span className="hidden md:inline">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User and Logout */}
      {isAuthenticated && (
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden min-w-0 text-right sm:block">
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
            title="Log out"
            aria-label="Log out"
            className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={18} />

            <span className="hidden lg:inline">
              Logout
            </span>
          </button>
        </div>
      )}
    </header>
  );
}
