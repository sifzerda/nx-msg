// src/lib/logout.js

"use client";

import { createClient } from "@/lib/supabase/client";

import { clearMessageProfileCache } from "@/lib/messageProfiles";
import { clearAttachmentCache } from "@/lib/extras/attachments";
import { clearLinkPreviewCache } from "@/lib/linkPreviews";

import usePushStore from "@/store/usePushStore";
import useChatStore from "@/store/useChatStore";
import useContactStore from "@/store/useContactStore";
import usePresenceStore from "@/store/usePresenceStore";
import useBlockStore from "@/store/useBlockStore";

const supabase = createClient();

let logoutRequest = null;

/* -------------------- PUSH CLEANUP -------------------- */

async function cleanupPushSubscription() {
    let cleanupError = null;

    if (
        typeof navigator === "undefined" ||
        !("serviceWorker" in navigator)
    ) {
        return null;
    }

    try {
        const registration =
            await navigator.serviceWorker.getRegistration("/");

        const subscription =
            await registration?.pushManager?.getSubscription();

        if (!subscription) {
            return null;
        }

        /* -------------------- SERVER CLEANUP -------------------- */

        try {
            const response = await fetch(
                "/api/push/unsubscribe",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                    },

                    cache: "no-store",

                    body: JSON.stringify({
                        endpoint: subscription.endpoint,

                        // Preserve the user's saved preference.
                        rememberPreference: false,
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
            cleanupError = error;

            console.error(
                "Server push cleanup failed:",
                error
            );
        }

        /* -------------------- BROWSER CLEANUP -------------------- */

        // Remove the browser subscription regardless
        // of whether server cleanup succeeded.

        try {
            const removed =
                await subscription.unsubscribe();

            if (!removed) {
                throw new Error(
                    "Browser subscription could not be removed"
                );
            }

        } catch (error) {
            cleanupError ??= error;

            console.error(
                "Browser push cleanup failed:",
                error
            );
        }

    } catch (error) {
        cleanupError ??= error;

        console.error(
            "Push cleanup failed:",
            error
        );
    }

    return cleanupError;
}

/* -------------------- RESET STORES -------------------- */

function resetStores() {
    usePushStore.getState().reset();
    useBlockStore.getState().reset();
    useChatStore.getState().reset();
    useContactStore.getState().reset();
    usePresenceStore.getState().reset();
}

/* -------------------- CLEAR CACHES -------------------- */

function clearCaches() {
    clearMessageProfileCache();
    clearAttachmentCache();
    clearLinkPreviewCache();
}

/* -------------------- LOGOUT OPERATION -------------------- */

async function performLogout() {
    let pushCleanupError = null;
    let signedOut = false;

    try {
        /* -------------------- LOCK PUSH OPERATIONS -------------------- */

        try {
            await usePushStore
                .getState()
                .prepareForLogout();

        } catch (error) {
            pushCleanupError = error;

            console.error(
                "Failed to prepare notifications for logout:",
                error
            );
        }

        /* -------------------- PUSH CLEANUP -------------------- */

        const cleanupError =
            await cleanupPushSubscription();

        pushCleanupError ??= cleanupError;

        /* -------------------- SIGN OUT -------------------- */

        const { error: signOutError } =
            await supabase.auth.signOut();

        if (signOutError) {
            throw signOutError;
        }

        signedOut = true;

        /* -------------------- RESET APPLICATION -------------------- */

        resetStores();
        clearCaches();

        return {
            success: true,
            pushCleanupError,
        };

    } catch (error) {
        if (!signedOut) {
            const pushStore = usePushStore.getState();

            pushStore.cancelLogout();

            // Push cleanup may already have removed
            // the subscription. Restore the saved
            // preference if the user remains signed in.

            void pushStore.refresh().catch(
                (restoreError) => {
                    console.error(
                        "Failed to restore notifications:",
                        restoreError
                    );
                }
            );
        }

        throw error;
    }
}

/* -------------------- PUBLIC LOGOUT -------------------- */

export function logout() {
    if (logoutRequest) {
        return logoutRequest;
    }

    const request = Promise.resolve()
        .then(performLogout)
        .finally(() => {
            if (logoutRequest === request) {
                logoutRequest = null;
            }
        });

    logoutRequest = request;

    return request;
}