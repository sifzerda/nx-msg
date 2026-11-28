// src/components/settings/PrivacySettings.jsx

"use client";

import {
    useEffect,
    useRef,
    useState,
    useDeferredValue,
} from "react";

import { useShallow } from "zustand/react/shallow";

import {
    ShieldBan,
    ShieldCheck,
    UserRound,
    Search,
    RefreshCw,
    LoaderCircle,
    AlertCircle,
    Info,
    X,
} from "lucide-react";

import useBlockStore from "@/store/useBlockStore";
import SettingsSection from "./SettingsSection";

const buttonClass =
    "flex items-center justify-center gap-2 rounded-lg " +
    "border border-border px-3 py-2 text-sm font-medium " +
    "text-foreground hover:bg-surface-hover " +
    "disabled:cursor-not-allowed disabled:opacity-50";

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
});

function formatDate(value) {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : dateFormatter.format(date);
}

function getDisplayName(user) {
    return user?.display_name || user?.username || "Unknown user";
}

function BlockedUserCard({ user, pending, onUnblock }) {
    const name = getDisplayName(user);
    const blockedDate = formatDate(user.blocked_at);

    return (
        <article className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary p-3 sm:p-4">
            <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-active text-muted">
                <UserRound size={22} />

                {user.avatar_url && (
                    <img
                        key={user.avatar_url}
                        src={user.avatar_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 size-full object-cover"
                        onError={(event) => {
                            event.currentTarget.hidden = true;
                        }}
                    />
                )}
            </div>

            <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-foreground">
                    {name}
                </h3>

                {user.username && (
                    <p className="truncate text-xs text-muted">
                        @{user.username}
                    </p>
                )}

                {blockedDate && (
                    <p className="mt-1 text-xs text-muted">
                        Blocked {blockedDate}
                    </p>
                )}
            </div>

            <button
                type="button"
                disabled={pending}
                onClick={() => onUnblock(user)}
                aria-label={`Unblock ${name}`}
                className={`${buttonClass} shrink-0`}
            >
                {pending ? (
                    <LoaderCircle size={16} className="animate-spin" />
                ) : (
                    <ShieldCheck size={16} />
                )}

                <span>
                    {pending ? "Unblocking..." : "Unblock"}
                </span>
            </button>
        </article>
    );
}

export default function PrivacySettings() {
    const dialogRef = useRef(null);
    const submittingRef = useRef(false);

    const [search, setSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);
    const [mutationError, setMutationError] = useState(null);

    const deferredSearch = useDeferredValue(search);

    const {
        blockedUsers,
        pendingUsers,
        loading,
        loaded,
        error,
        lastFetchedAt,
        fetchBlockedUsers,
        unblock,
    } = useBlockStore(
        useShallow((state) => ({
            blockedUsers: state.blockedUsers,
            pendingUsers: state.pendingUsers,
            loading: state.loading,
            loaded: state.loaded,
            error: state.error,
            lastFetchedAt: state.lastFetchedAt,
            fetchBlockedUsers: state.fetchBlockedUsers,
            unblock: state.unblock,
        }))
    );

    const hasPendingMutations =
        Object.keys(pendingUsers).length > 0;

    const selectedPending = Boolean(
        selectedUser && pendingUsers[selectedUser.user_id]
    );

    useEffect(() => {
        void fetchBlockedUsers().catch(() => {
            // Errors are handled by the store.
        });
    }, [fetchBlockedUsers]);

    const query = deferredSearch.trim().toLowerCase();

    const filteredUsers = query
        ? blockedUsers.filter((user) =>
            (user.display_name || "").toLowerCase().includes(query) ||
            (user.username || "").toLowerCase().includes(query)
        )
        : blockedUsers;

    async function handleRefresh() {
        try {
            await fetchBlockedUsers({ force: true });
        } catch {
            // Errors are handled by the store.
        }
    }

    function openConfirmation(user) {
        setSelectedUser(user);
        setMutationError(null);
        dialogRef.current?.showModal();
    }

    function clearConfirmation() {
        setSelectedUser(null);
        setMutationError(null);
    }

    function closeConfirmation() {
        if (selectedPending || submittingRef.current) return;

        dialogRef.current?.close();
        clearConfirmation();
    }

    async function handleUnblock() {
        if (
            !selectedUser ||
            selectedPending ||
            submittingRef.current
        ) {
            return;
        }

        submittingRef.current = true;
        setMutationError(null);

        try {
            const success = await unblock(selectedUser.user_id);

            if (!success) {
                setMutationError("Unable to unblock user.");
                return;
            }

            dialogRef.current?.close();
        } catch (error) {
            setMutationError(
                error?.message || "Unable to unblock user."
            );
        } finally {
            submittingRef.current = false;
        }
    }

    return (
        <div className="space-y-5">
            <header>
                <h1 className="text-xl font-semibold text-foreground">
                    Privacy &amp; safety
                </h1>

                <p className="mt-1 text-sm text-muted">
                    Control how other users interact with you.
                </p>
            </header>

            <SettingsSection
                title="Blocked users"
                description="View and manage users you have blocked."
                icon={ShieldBan}
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-4">
                        <Info
                            size={19}
                            className="mt-0.5 shrink-0 text-muted"
                        />

                        <p className="text-sm leading-relaxed text-muted">
                            Blocking prevents both users from sending private
                            messages to each other. Existing message history
                            and shared group conversations are preserved.
                            You can unblock a user at any time.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">
                            {blockedUsers.length} blocked{" "}
                            {blockedUsers.length === 1 ? "user" : "users"}
                        </span>

                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={loading || hasPendingMutations}
                            className={buttonClass}
                        >
                            <RefreshCw
                                size={15}
                                className={loading ? "animate-spin" : ""}
                            />

                            Refresh
                        </button>
                    </div>

                    {blockedUsers.length > 0 && (
                        <div className="relative">
                            <Search
                                size={18}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                            />

                            <input
                                type="search"
                                aria-label="Search blocked users"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search blocked users..."
                                className="w-full rounded-lg border border-border bg-input py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted"
                            />

                            {search && (
                                <button
                                    type="button"
                                    aria-label="Clear search"
                                    onClick={() => setSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                                >
                                    <X size={17} />
                                </button>
                            )}
                        </div>
                    )}

                    {error && (
                        <div
                            role="alert"
                            className="flex items-start gap-2 rounded-lg border border-red-500/30 p-3 text-sm text-red-500"
                        >
                            <AlertCircle size={18} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {loading && !loaded && (
                        <div
                            role="status"
                            className="flex items-center justify-center gap-2 py-8 text-sm text-muted"
                        >
                            <LoaderCircle size={20} className="animate-spin" />
                            Loading blocked users...
                        </div>
                    )}

                    {loaded && blockedUsers.length === 0 && !loading && (
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
                            <ShieldCheck size={32} className="text-muted" />

                            <p className="font-medium text-foreground">
                                No blocked users
                            </p>

                            <p className="text-sm text-muted">
                                Users you block will appear here.
                            </p>
                        </div>
                    )}

                    {query && blockedUsers.length > 0 &&
                        filteredUsers.length === 0 && (
                            <p className="py-6 text-center text-sm text-muted">
                                No matching blocked users.
                            </p>
                        )}

                    <div className="space-y-2">
                        {filteredUsers.map((user) => (
                            <BlockedUserCard
                                key={user.user_id}
                                user={user}
                                pending={Boolean(pendingUsers[user.user_id])}
                                onUnblock={openConfirmation}
                            />
                        ))}
                    </div>

                    {lastFetchedAt && (
                        <p className="text-xs text-muted">
                            Last refreshed:{" "}
                            {new Date(lastFetchedAt).toLocaleTimeString("en-AU")}
                        </p>
                    )}
                </div>
            </SettingsSection>

            <dialog
                ref={dialogRef}
                aria-labelledby="unblock-user-title"
                onCancel={(event) => {
                    if (selectedPending || submittingRef.current) {
                        event.preventDefault();
                    } else {
                        clearConfirmation();
                    }
                }}
                onClose={clearConfirmation}
                className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface p-5 text-foreground shadow-xl backdrop:bg-black/60"
            >
                <div className="space-y-4">
                    <h2
                        id="unblock-user-title"
                        className="text-lg font-semibold"
                    >
                        Unblock {getDisplayName(selectedUser)}?
                    </h2>

                    <p className="text-sm leading-relaxed text-muted">
                        This removes your block on this user. Private
                        messaging may become available again, provided
                        they have not also blocked you.
                    </p>

                    {mutationError && (
                        <p role="alert" className="text-sm text-red-500">
                            {mutationError}
                        </p>
                    )}

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            autoFocus
                            disabled={selectedPending}
                            onClick={closeConfirmation}
                            className={buttonClass}
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            disabled={selectedPending}
                            aria-busy={selectedPending}
                            onClick={handleUnblock}
                            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
                        >
                            {selectedPending && (
                                <LoaderCircle
                                    size={16}
                                    className="animate-spin"
                                />
                            )}

                            {selectedPending ? "Unblocking..." : "Unblock"}
                        </button>
                    </div>
                </div>
            </dialog>
        </div>
    );
}