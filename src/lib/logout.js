// src/lib/logout.js

"use client";

import { createClient } from "@/lib/supabase/client";
import { clearMessageProfileCache } from "@/lib/messageProfiles";

import useChatStore from "@/store/useChatStore";
import useContactStore from "@/store/useContactStore";
import usePresenceStore from "@/store/usePresenceStore";

const supabase = createClient();

export async function logout() {
  let pushCleanupError = null;

  // Attempt notification cleanup before signing out.
  if (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator
  ) {
    try {
      const registration =
        await navigator.serviceWorker.getRegistration("/");

      const subscription =
        await registration?.pushManager?.getSubscription();

      if (subscription) {
        try {
          const response = await fetch(
            "/api/push/unsubscribe",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                endpoint: subscription.endpoint,
              }),
            }
          );

          if (!response.ok) {
            const result = await response
              .json()
              .catch(() => ({}));

            throw new Error(
              result.error ||
                `Push unsubscribe failed (${response.status})`
            );
          }
        } catch (error) {
          pushCleanupError = error;
          console.error(
            "Server push cleanup failed:",
            error
          );
        }

        // Remove the browser's subscription regardless
        // of whether the database request succeeded.
        try {
          const removed = await subscription.unsubscribe();

          if (!removed) {
            throw new Error(
              "Browser subscription could not be removed"
            );
          }
        } catch (error) {
          pushCleanupError ??= error;
          console.error(
            "Browser push cleanup failed:",
            error
          );
        }
      }
    } catch (error) {
      pushCleanupError = error;
      console.error(
        "Push cleanup failed:",
        error
      );
    }
  }

  // Always attempt to sign out.
  const { error: signOutError } =
    await supabase.auth.signOut();

  if (signOutError) {
    throw signOutError;
  }

  useChatStore.getState().reset();
  useContactStore.getState().reset();
  usePresenceStore.getState().reset();

  clearMessageProfileCache();

  return {
    success: true,
    pushCleanupError,
  };
}
