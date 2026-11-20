// src/components/LogoutButton.jsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "../lib/logout";

export default function LogoutButton() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const result = await logout();

      if (result.pushCleanupError) {
        console.warn(
          "Push cleanup incomplete:",
          result.pushCleanupError
        );
      }

      router.replace("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);

      setError(
        err.message || "Could not log out"
      );

      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-white transition hover:bg-red-500 disabled:opacity-50"
      >
        <LogOut size={18} />

        {loading ? "Logging out..." : "Logout"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
