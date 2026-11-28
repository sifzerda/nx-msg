// src/components/SessionInitializer.jsx

"use client";

import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

import {
  resetApplication,
  isLoggingOut,
  SESSION_CHANGE_KEY,
} from "@/lib/logout";

import usePushStore from "@/store/usePushStore";

export default function SessionInitializer({
  userId = null,
}) {
  useEffect(() => {
    const supabase = createClient();

    let active = true;
    let reloading = false;
    let reloadTimer = null;

    /* -------------------- SESSION CHANGE -------------------- */

    function reloadSession() {
      if (
        !active ||
        reloading ||
        isLoggingOut()
      ) {
        return;
      }

      reloading = true;

      // Run outside the Supabase authentication callback.
      reloadTimer = window.setTimeout(() => {
        if (!active) return;

        if (isLoggingOut()) {
          reloading = false;
          return;
        }

        try {
          resetApplication();
        } finally {
          window.location.reload();
        }
      }, 0);
    }

    /* -------------------- AUTHENTICATION EVENTS -------------------- */

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active || reloading) return;

        if (
          event === "INITIAL_SESSION" ||
          event === "TOKEN_REFRESHED"
        ) {
          return;
        }

        if (
          event !== "SIGNED_IN" &&
          event !== "SIGNED_OUT"
        ) {
          return;
        }

        const nextUserId =
          session?.user?.id ?? null;

        if (nextUserId !== userId) {
          reloadSession();
        }
      }
    );

    /* -------------------- CROSS-TAB EVENTS -------------------- */

    function handleStorage(event) {
      if (
        event.key === SESSION_CHANGE_KEY &&
        event.newValue
      ) {
        reloadSession();
      }
    }

    window.addEventListener(
      "storage",
      handleStorage
    );

    /* -------------------- PUSH INITIALISATION -------------------- */

    const pushStore = usePushStore.getState();

    if (userId) {
      void pushStore.initialize(userId);
    } else {
      pushStore.reset();
    }

    /* -------------------- CLEANUP -------------------- */

    return () => {
      active = false;

      subscription.unsubscribe();

      window.removeEventListener(
        "storage",
        handleStorage
      );

      if (reloadTimer !== null) {
        window.clearTimeout(reloadTimer);
      }
    };
  }, [userId]);

  return null;
}