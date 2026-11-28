// src/lib/logout.js

"use client";

import { createClient } from "@/lib/supabase/client";
import { cleanupPushForLogout } from "@/lib/pushClient";

import { clearMessageProfileCache } from "@/lib/messageProfiles";
import { clearAttachmentCache } from "@/lib/extras/attachments";
import { clearLinkPreviewCache } from "@/lib/extras/linkPreviews";

import usePushStore from "@/store/usePushStore";
import useChatStore from "@/store/useChatStore";
import useContactStore from "@/store/useContactStore";
import usePresenceStore from "@/store/usePresenceStore";
import useBlockStore from "@/store/useBlockStore";

let logoutRequest = null;

export function redirectAfterLogout() {
    window.location.replace("/login");
}

/* -------------------- APPLICATION CLEANUP -------------------- */

export function resetApplication() {
    usePushStore.getState().reset();
    useBlockStore.getState().reset();
    useChatStore.getState().reset();
    useContactStore.getState().reset();
    usePresenceStore.getState().reset();

    clearMessageProfileCache();
    clearAttachmentCache();
    clearLinkPreviewCache();
}

export function isLoggingOut() {
    return logoutRequest !== null;
}

/* -------------------- SESSION SYNCHRONISATION -------------------- */

export const SESSION_CHANGE_KEY =
    "messenger:session-change";

export function notifySessionChange() {
    try {
        window.localStorage.setItem(
            SESSION_CHANGE_KEY,
            crypto.randomUUID()
        );
    } catch {
        // Storage may be unavailable or restricted.
    }
}

/* -------------------- PUSH CLEANUP -------------------- */

async function prepareNotifications() {
    let cleanupError = null;

    try {
        await usePushStore.getState().prepareForLogout();
    } catch (error) {
        cleanupError = error;
    }

    try {
        const error = await cleanupPushForLogout();
        cleanupError ??= error;
    } catch (error) {
        cleanupError ??= error;
    }

    if (cleanupError) {
        console.error(
            "Push logout cleanup failed:",
            cleanupError.message
        );
    }

    return cleanupError;
}

/* -------------------- RECOVERY -------------------- */

function restoreNotifications() {
    const store = usePushStore.getState();

    store.cancelLogout();

    void store.refresh().catch((error) => {
        console.error(
            "Failed to restore notifications:",
            error?.message
        );
    });
}

/* -------------------- LOGOUT -------------------- */

async function performLogout() {
    const supabase = createClient();

    let signedOut = false;

    try {
        const pushCleanupError =
            await prepareNotifications();

        const { error } =
            await supabase.auth.signOut();

        if (error) throw error;

        signedOut = true;

        resetApplication();
        notifySessionChange();

        return {
            success: true,
            pushCleanupError,
        };
    } catch (error) {
        if (!signedOut) {
            restoreNotifications();
        }

        throw error;
    }
}

/* -------------------- PUBLIC API -------------------- */

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