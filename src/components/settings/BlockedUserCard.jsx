// src/components/settings/BlockedUserCard.jsx

"use client";

import { memo } from "react";

import {
    UserRound,
    ShieldCheck,
    LoaderCircle,
} from "lucide-react";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
});

function formatBlockedDate(value) {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : dateFormatter.format(date);
}

function BlockedUserCard({
    user,
    pending,
    onUnblock,
}) {
    const displayName =
        user.display_name ||
        user.username ||
        "Unknown user";

    const blockedDate = formatBlockedDate(
        user.blocked_at
    );

    return (
        <article className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4">

            {/* Avatar */}

            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-800 text-gray-400">

                <UserRound size={24} />

                {user.avatar_url && (
                    <img
                        key={user.avatar_url}
                        src={user.avatar_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(event) => {
                            event.currentTarget.hidden = true;
                        }}
                    />
                )}
            </div>

            {/* User information */}

            <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-white">
                    {displayName}
                </h3>

                {user.username && (
                    <p className="truncate text-xs text-gray-400">
                        @{user.username}
                    </p>
                )}

                {blockedDate && (
                    <p className="mt-1 text-xs text-gray-500">
                        Blocked {blockedDate}
                    </p>
                )}
            </div>

            {/* Unblock button */}

            <button
                type="button"
                disabled={pending}
                onClick={() => onUnblock(user)}
                aria-label={`Unblock ${displayName}`}
                className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-blue-500 hover:bg-blue-600/10 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {pending ? (
                    <LoaderCircle
                        size={16}
                        className="animate-spin"
                    />
                ) : (
                    <ShieldCheck size={16} />
                )}

                <span>
                    {pending
                        ? "Unblocking..."
                        : "Unblock"}
                </span>
            </button>
        </article>
    );
}

export default memo(BlockedUserCard);