// src/components/Footer.jsx

import Link from "next/link";

export default function Footer({ user = null }) {
  const isAuthenticated = Boolean(user);

  const links = isAuthenticated
    ? [
        { href: "/messages", label: "Messages" },
        { href: "/contacts", label: "Contacts" },
      ]
    : [
        { href: "/login", label: "Login" },
        { href: "/register", label: "Register" },
      ];

  return (
    <footer className="flex h-10 shrink-0 items-center justify-between gap-4 border-t border-gray-800 bg-gray-900 px-4 text-xs text-gray-400 md:px-6">
      {/* Copyright */}
      <p className="shrink-0">
        © {new Date().getFullYear()} Messenger
      </p>

      {/* User and navigation */}
      <div className="flex min-w-0 items-center gap-4">
        {isAuthenticated && (
          <span className="hidden max-w-40 truncate text-gray-500 sm:inline">
            Logged in as {user.display_name || "User"}
          </span>
        )}

        <nav className="flex items-center gap-4">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="transition hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
