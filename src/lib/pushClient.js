// src/lib/pushClient.js
import { createClient } from "@/lib/supabase/client";

/* -------------------- SUPPORT -------------------- */

export function isPushSupported() {
    return (
        typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

/* -------------------- VAPID -------------------- */

function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);

    const base64 = (value + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const raw = atob(base64);

    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/* -------------------- API -------------------- */

async function postJSON(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(body),
    });

    const result = await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
        throw new Error(result.error || `Request failed (${response.status})`);
    }

    return result;
}

/* -------------------- PREFERENCE -------------------- */

export async function getPushPreference(userId) {
    if (!userId) {
        throw new Error("User ID is required");
    }

    const supabase = createClient();

    const { data, error } = await supabase
        .from("profiles")
        .select("notifications_enabled")
        .eq("id", userId)
        .single();

    if (error) throw error;

    return data.notifications_enabled === true;
}

export async function disablePushPreference(userId) {
    if (!userId) {
        throw new Error("User ID is required");
    }

    const supabase = createClient();

    const { error } = await supabase
        .from("profiles")
        .update({
            notifications_enabled: false,
        })
        .eq("id", userId);

    if (error) throw error;
}

/* -------------------- SERVICE WORKER -------------------- */

async function getRegistration() {
    await navigator.serviceWorker.register("/sw.js");

    return navigator.serviceWorker.ready;
}

/* -------------------- SUBSCRIPTION -------------------- */

async function createSubscription(registration) {
    const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
        throw new Error("Missing VAPID public key");
    }

    return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey:
            urlBase64ToUint8Array(publicKey),
    });
}

async function getOrCreateSubscription() {
    const registration = await getRegistration();

    const existing =
        await registration.pushManager.getSubscription();

    if (existing) {
        return existing;
    }

    return createSubscription(registration);
}

async function registerSubscription(
    subscription,
    rememberPreference
) {
    return postJSON("/api/push/subscribe", {
        subscription: subscription.toJSON(),
        rememberPreference,
    });
}

/* -------------------- RESTORE -------------------- */

export async function restorePushNotifications(userId) {
    if (!isPushSupported()) {
        return {
            preference: false,
            enabled: false,
        };
    }

    const preference =
        await getPushPreference(userId);

    if (
        !preference ||
        Notification.permission !== "granted"
    ) {
        return {
            preference,
            enabled: false,
        };
    }

    const subscription =
        await getOrCreateSubscription();

    await registerSubscription(
        subscription,
        false
    );

    return {
        preference: true,
        enabled: true,
    };
}

/* -------------------- ENABLE -------------------- */

export async function enablePushNotifications() {
    if (!isPushSupported()) {
        throw new Error(
            "Push notifications are not supported"
        );
    }

    const permission =
        Notification.permission === "granted"
            ? "granted"
            : await Notification.requestPermission();

    if (permission !== "granted") {
        throw new Error(
            "Notification permission was not granted"
        );
    }

    const subscription =
        await getOrCreateSubscription();

    await registerSubscription(
        subscription,
        true
    );

    return {
        preference: true,
        enabled: true,
    };
}

/* -------------------- DISABLE -------------------- */

export async function disablePushNotifications(userId) {
    const registration =
        await navigator.serviceWorker.getRegistration();

    const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null;

    if (!subscription) {
        await disablePushPreference(userId);

        return {
            preference: false,
            enabled: false,
        };
    }

    await postJSON("/api/push/unsubscribe", {
        endpoint: subscription.endpoint,
        rememberPreference: true,
    });

    let warning = null;

    try {
        const removed =
            await subscription.unsubscribe();

        if (!removed) {
            warning =
                "Notifications are disabled, but the browser subscription could not be removed.";
        }
    } catch {
        warning =
            "Notifications are disabled, but browser subscription cleanup failed.";
    }

    return {
        preference: false,
        enabled: false,
        warning,
    };
}