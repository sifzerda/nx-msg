// src/components/extras/ChatBlockMenu.jsx

"use client";

import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import {
  EllipsisVertical,
  Ban,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";

import useBlockStore from "@/store/useBlockStore";

function ChatBlockMenu({
  userId,
  displayName,
  isBlocked,
}) {
  const menuRef = useRef(null);
  const dialogRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [error, setError] = useState(null);

  const block = useBlockStore((state) => state.block);
  const unblock = useBlockStore((state) => state.unblock);
  const dialogTitleId = useId();
  const pendingAction = useBlockStore((state) => state.pendingUsers[userId]);
  const submittingRef = useRef(false);
  const isPending = Boolean(pendingAction);

  /* -------------------- OUTSIDE CLICK -------------------- */

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [menuOpen]);

  /* -------------------- CONFIRMATION -------------------- */

  function openConfirmation() {
    setMenuOpen(false);
    setError(null);

    setConfirmAction(
      isBlocked ? "unblock" : "block"
    );

    dialogRef.current?.showModal();
  }

  function closeConfirmation() {
    dialogRef.current?.close();
    setConfirmAction(null);
    setError(null);
  }

  /* -------------------- BLOCK OPERATION -------------------- */

  async function handleConfirm() {
    if (
      !userId ||
      !confirmAction ||
      isPending ||
      submittingRef.current
    ) {
      return;
    }

    submittingRef.current = true;

    setError(null);

    try {
      const success =
        confirmAction === "block"
          ? await block(userId)
          : await unblock(userId);

      if (!success) {
        return;
      }

      closeConfirmation();

    } catch (error) {
      setError(
        error?.message ||
        "Unable to update blocking status"
      );

    } finally {
      submittingRef.current = false;
    }
  }

  if (!userId) return null;

  const confirmingUnblock =
    confirmAction === "unblock";

  return (
    <div
      ref={menuRef}
      className="relative shrink-0"
    >
      {/* Menu trigger */}

      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        disabled={isPending}
        aria-label="Conversation options"
        aria-expanded={menuOpen}
        title="Conversation options"
        className="flex items-center justify-center rounded-lg border border-gray-700 bg-gray-900 p-2.5 text-gray-300 transition-colors hover:border-blue-500 hover:text-white disabled:opacity-50"
      >
        {isPending ? (
          <LoaderCircle
            size={18}
            className="animate-spin"
          />
        ) : (
          <EllipsisVertical size={18} />
        )}
      </button>

      {/* Dropdown */}

      {menuOpen && (
        <div className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 p-1 shadow-xl">
          <button
            type="button"
            onClick={openConfirmation}
            disabled={isPending}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${isBlocked
              ? "text-green-400 hover:bg-green-950/40"
              : "text-red-400 hover:bg-red-950/40"
              }`}
          >
            {isBlocked ? (
              <ShieldCheck size={17} />
            ) : (
              <Ban size={17} />
            )}

            {isBlocked
              ? "Unblock user"
              : "Block user"}
          </button>
        </div>
      )}

      {/* Native confirmation dialog */}

      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        onCancel={(event) => {
          if (isPending) {
            event.preventDefault();
          } else {
            setConfirmAction(null);
            setError(null);
          }
        }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 text-gray-200 shadow-2xl backdrop:bg-black/70"
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${confirmingUnblock
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
              }`}
          >
            {confirmingUnblock ? (
              <ShieldCheck size={23} />
            ) : (
              <Ban size={23} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2
              id={dialogTitleId}
              className="break-words text-lg font-semibold text-white"
            >
              {confirmingUnblock
                ? `Unblock ${displayName}?`
                : `Block ${displayName}?`}
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              {confirmingUnblock
                ? "Private messaging may become available again, provided this user has not also blocked you."
                : "Neither of you will be able to send private messages to each other. Your existing conversation history and shared group conversations will be preserved."}
            </p>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-400"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            autoFocus
            aria-busy={isPending}
            disabled={isPending}
            onClick={closeConfirmation}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${confirmingUnblock
              ? "bg-blue-600 hover:bg-blue-500"
              : "bg-red-600 hover:bg-red-500"
              }`}
          >
            {isPending && (
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
            )}

            {isPending
              ? confirmingUnblock
                ? "Unblocking..."
                : "Blocking..."
              : confirmingUnblock
                ? "Unblock"
                : "Block"}
          </button>
        </div>
      </dialog>
    </div>
  );
}

export default memo(ChatBlockMenu);