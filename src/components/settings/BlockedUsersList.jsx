// src/components/settings/BlockedUsersList.jsx

"use client";

import {
    useCallback,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    Search,
    RefreshCw,
    ShieldCheck,
    LoaderCircle,
    AlertCircle,
    X,
} from "lucide-react";

import useBlockStore from "@/store/useBlockStore";

import BlockedUserCard from "./BlockedUserCard";

export default function BlockedUsersList() {
    const dialogRef = useRef(null);

    const [search, setSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);
    const [mutationError, setMutationError] = useState(null);

    const deferredSearch = useDeferredValue(search);

    /* -------------------- ZUSTAND -------------------- */

    const blockedUsers = useBlockStore(
        (state) => state.blockedUsers
    );

    const pendingUsers = useBlockStore(
        (state) => state.pendingUsers
    );

    const loading = useBlockStore(
        (state) => state.loading
    );

    const loaded = useBlockStore(
        (state) => state.loaded
    );

    const error = useBlockStore(
        (state) => state.error
    );

    const lastFetchedAt = useBlockStore(
        (state) => state.lastFetchedAt
    );

    const fetchBlockedUsers = useBlockStore(
        (state) => state.fetchBlockedUsers
    );

    const unblock = useBlockStore(
        (state) => state.unblock
    );

    const hasPendingMutations =
        Object.keys(pendingUsers).length > 0;

    const selectedPending = Boolean(
        selectedUser &&
        pendingUsers[selectedUser.user_id]
    );

    /* -------------------- INITIAL FETCH -------------------- */

    useEffect(() => {
        void fetchBlockedUsers().catch(() => {
            // Error is handled by the store.
        });
    }, [fetchBlockedUsers]);

    /* -------------------- LOCAL SEARCH -------------------- */

    const filteredUsers = useMemo(() => {
        const query = deferredSearch
            .trim()
            .toLowerCase();

        if (!query) {
            return blockedUsers;
        }

        return blockedUsers.filter((user) => {
            const displayName =
                user.display_name?.toLowerCase() || "";

            const username =
                user.username?.toLowerCase() || "";

            return (
                displayName.includes(query) ||
                username.includes(query)
            );
        });
    }, [blockedUsers, deferredSearch]);

    /* -------------------- REFRESH -------------------- */

    const handleRefresh = useCallback(async () => {
        try {
            await fetchBlockedUsers({
                force: true,
            });
        } catch {
            // Error is handled by the store.
        }
    }, [fetchBlockedUsers]);

    /* -------------------- CONFIRMATION -------------------- */

    const openConfirmation = useCallback((user) => {
        setSelectedUser(user);
        setMutationError(null);

        dialogRef.current?.showModal();
    }, []);

    const closeConfirmation = useCallback(() => {
        dialogRef.current?.close();

        setSelectedUser(null);
        setMutationError(null);
    }, []);

    /* -------------------- UNBLOCK -------------------- */

    async function handleUnblock() {
        if (!selectedUser || selectedPending) {
            return;
        }

        setMutationError(null);

        try {
            const success = await unblock(
                selectedUser.user_id
            );

            if (!success) return;

            closeConfirmation();

            // The store already removes the unblocked
            // user locally. No immediate list RPC needed.

        } catch (error) {
            setMutationError(
                error?.message ||
                "Unable to unblock this user"
            );
        }
    }

    const selectedName =
        selectedUser?.display_name ||
        selectedUser?.username ||
        "this user";

    /* -------------------- RENDER -------------------- */

    return (
        <section className="space-y-4">

            {/* List toolbar */}

            <div className="flex items-center justify-between gap-3">

                <p className="text-sm text-gray-400">
                    {blockedUsers.length} blocked{" "}
                    {blockedUsers.length === 1
                        ? "user"
                        : "users"}
                </p>

                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={
                        loading ||
                        hasPendingMutations
                    }
                    className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-blue-500 hover:text-white disabled:opacity-50"
                >
                    <RefreshCw
                        size={16}
                        className={
                            loading
                                ? "animate-spin"
                                : ""
                        }
                    />

                    Refresh
                </button>
            </div>

            {/* Search */}

            <div className="relative">

                <Search
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />

                <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                        setSearch(event.target.value)
                    }
                    placeholder="Search blocked users..."
                    aria-label="Search blocked users"
                    className="w-full rounded-xl border border-gray-800 bg-gray-900 py-3 pl-10 pr-10 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-500"
                />

                {search && (
                    <button
                        type="button"
                        onClick={() => setSearch("")}
                        aria-label="Clear search"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                        <X size={17} />
                    </button>
                )}
            </div>

            {/* Errors */}

            {error && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-400"
                >
                    <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0"
                    />

                    <p>{error}</p>
                </div>
            )}

            {/* Initial loading */}

            {loading && blockedUsers.length === 0 && (
                <div className="flex items-center justify-center gap-3 py-12 text-sm text-gray-400">
                    <LoaderCircle
                        size={20}
                        className="animate-spin"
                    />

                    Loading blocked users...
                </div>
            )}

            {/* Blocked user cards */}

            {filteredUsers.length > 0 && (
                <div className="space-y-3">
                    {filteredUsers.map((user) => (
                        <BlockedUserCard
                            key={user.user_id}
                            user={user}
                            pending={Boolean(
                                pendingUsers[user.user_id]
                            )}
                            onUnblock={openConfirmation}
                        />
                    ))}
                </div>
            )}

            {/* Empty state */}

            {!loading &&
                !error &&
                blockedUsers.length === 0 &&
                (loaded || lastFetchedAt === 0) && (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-800 px-4 py-12 text-center">

                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-gray-500">
                            <ShieldCheck size={28} />
                        </div>

                        <h3 className="font-medium text-gray-200">
                            No blocked users
                        </h3>

                        <p className="text-sm text-gray-500">
                            You have no users in your blocked list.
                        </p>
                    </div>
                )}

            {/* No search results */}

            {!loading &&
                blockedUsers.length > 0 &&
                filteredUsers.length === 0 && (
                    <div className="py-10 text-center text-sm text-gray-500">
                        No matching blocked users.
                    </div>
                )}

            {/* Invalidated cache notice */}

            {!loaded &&
                !loading &&
                !error &&
                blockedUsers.length > 0 && (
                    <p className="text-xs text-gray-500">
                        The list may have changed.
                        Select Refresh to retrieve the latest results.
                    </p>
                )}

            {/* Unblock confirmation dialog */}

            <dialog
                ref={dialogRef}
                aria-labelledby="unblock-user-title"
                onCancel={(event) => {
                    if (selectedPending) {
                        event.preventDefault();
                    } else {
                        setSelectedUser(null);
                        setMutationError(null);
                    }
                }}
                className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 text-gray-200 shadow-2xl backdrop:bg-black/70"
            >
                <div className="flex items-start gap-4">

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                        <ShieldCheck size={23} />
                    </div>

                    <div className="min-w-0 flex-1">

                        <h2
                            id="unblock-user-title"
                            className="break-words text-lg font-semibold text-white"
                        >
                            Unblock {selectedName}?
                        </h2>

                        <p className="mt-2 text-sm leading-relaxed text-gray-400">
                            Private messaging may become available
                            again, provided this user has not also
                            blocked you.
                        </p>
                    </div>
                </div>

                {mutationError && (
                    <p
                        role="alert"
                        className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-400"
                    >
                        {mutationError}
                    </p>
                )}

                <div className="mt-6 flex justify-end gap-3">

                    <button
                        type="button"
                        autoFocus
                        disabled={selectedPending}
                        onClick={closeConfirmation}
                        className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        disabled={
                            selectedPending ||
                            !selectedUser
                        }
                        onClick={handleUnblock}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                        {selectedPending && (
                            <LoaderCircle
                                size={16}
                                className="animate-spin"
                            />
                        )}

                        {selectedPending
                            ? "Unblocking..."
                            : "Unblock"}
                    </button>
                </div>
            </dialog>
        </section>
    );
}