// src/components/PushNotificationButton.jsx

"use client";

import { memo } from "react";

import {
    Bell,
    BellOff,
    LoaderCircle,
    AlertCircle,
    RefreshCw,
} from "lucide-react";

import usePushStore from "@/store/usePushStore";

function PushNotificationButton() {
    const supported = usePushStore((state) => state.supported);
    const initialized = usePushStore((state) => state.initialized);
    const checking = usePushStore((state) => state.checking);
    const enabled = usePushStore((state) => state.enabled);
    const preference = usePushStore((state) => state.preference);
    const loading = usePushStore((state) => state.loading);
    const signingOut = usePushStore((state) => state.signingOut);
    const error = usePushStore((state) => state.error);
    const warning = usePushStore((state) => state.warning);
    const enable = usePushStore((state) => state.enable);
    const disable = usePushStore((state) => state.disable);
    const refresh = usePushStore((state) => state.refresh);

    const busy = checking || loading || signingOut;
    const permission = supported && typeof Notification !== "undefined" ? Notification.permission : null;

    /* -------------------- LOADING -------------------- */

    if (checking || (!initialized && !error)) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-400">
                <LoaderCircle
                    size={17}
                    className="animate-spin"
                />

                Checking notifications...
            </div>
        );
    }

    /* -------------------- UNSUPPORTED -------------------- */

    if (!supported) {
        return (
            <div className="flex max-w-64 items-start gap-2 text-xs text-gray-400">
                <BellOff
                    size={17}
                    className="shrink-0"
                />

                <p>
                    Push notifications are not supported
                    by this browser.
                </p>
            </div>
        );
    }

    /* -------------------- RENDER -------------------- */

    return (
        <div className="flex flex-col items-start gap-2">

            {/* Notification status */}

            <div className="flex items-center gap-2 text-xs">

                <span
                    className={[
                        "h-2 w-2 rounded-full",

                        enabled
                            ? "bg-green-500"
                            : "bg-gray-500",
                    ].join(" ")}
                />

                <span className="text-gray-400">
                    {enabled
                        ? "Notifications enabled"
                        : "Notifications inactive"}
                </span>

            </div>

            {/* Main action */}

            <button
                type="button"
                disabled={
                    busy ||
                    !initialized ||
                    (!enabled && permission === "denied")
                }
                onClick={enabled ? disable : enable}
                className={[
                    "flex items-center gap-2",
                    "rounded-lg border px-3 py-2",
                    "text-sm font-medium transition-colors",

                    enabled
                        ? "border-gray-700 text-gray-300 hover:border-red-500 hover:text-red-400"
                        : "border-blue-600 bg-blue-600 text-white hover:bg-blue-500",

                    "disabled:cursor-not-allowed",
                    "disabled:opacity-50",
                ].join(" ")}
            >
                {loading ? (
                    <LoaderCircle
                        size={17}
                        className="animate-spin"
                    />
                ) : enabled ? (
                    <BellOff size={17} />
                ) : (
                    <Bell size={17} />
                )}

                {loading
                    ? "Please wait..."
                    : enabled
                        ? "Disable notifications"
                        : "Enable notifications"}
            </button>

            {/* Saved preference without active subscription */}

            {initialized && preference && !enabled && (
                <button
                    type="button"
                    disabled={busy}
                    onClick={disable}
                    className="text-xs text-gray-400 underline hover:text-white disabled:opacity-50"
                >
                    Disable saved notification preference
                </button>
            )}

            {/* Browser permission denied */}

            {permission === "denied" && (
                <p className="max-w-64 text-xs leading-relaxed text-amber-400">
                    Notifications are blocked by your browser.
                    Change the site permissions to enable them.
                </p>
            )}

            {/* Errors */}

            {error && (
                <div
                    role="alert"
                    className="flex max-w-64 items-start gap-2 text-xs text-red-400"
                >
                    <AlertCircle
                        size={15}
                        className="shrink-0"
                    />

                    <p>{error}</p>
                </div>
            )}

            {/* Warnings */}

            {warning && (
                <p
                    role="status"
                    className="max-w-64 text-xs text-amber-400"
                >
                    {warning}
                </p>
            )}

            {/* Retry / refresh */}

            <button
                type="button"
                disabled={busy}
                onClick={refresh}
                className="flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-white disabled:opacity-50"
            >
                <RefreshCw size={13} />

                {error
                    ? "Retry"
                    : "Refresh status"}
            </button>

        </div>
    );
}

export default memo(PushNotificationButton);