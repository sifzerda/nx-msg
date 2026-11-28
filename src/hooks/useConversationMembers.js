// src/hooks/useConversationMembers.js

"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getConversationMembers,
  subscribeToReadReceipts,
} from "@/lib/messages";

import {
  getPageVisible,
  subscribePageVisibility,
} from "./useBrowser";

const EMPTY_MEMBERS = Object.freeze([]);
const EMPTY_PROFILES = Object.freeze({});

/* -------------------- HELPERS -------------------- */

function getTimestamp(value) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp)
    ? timestamp
    : 0;
}

function latestReadAt(previous, incoming) {
  return getTimestamp(incoming) > getTimestamp(previous)
    ? incoming
    : previous ?? null;
}

function sameProfile(a, b) {
  return (
    a === b ||
    (
      a &&
      b &&
      a.id === b.id &&
      a.username === b.username &&
      a.display_name === b.display_name &&
      a.avatar_url === b.avatar_url
    )
  );
}

function reconcileMembers(
  previous,
  incoming,
  pendingReceipts
) {
  const previousById = new Map(
    previous.map((member) => [
      member.user_id,
      member,
    ])
  );

  const next = incoming.map((member) => {
    const old = previousById.get(member.user_id);

    const sameMembership =
      Boolean(old) &&
      old.joined_at === member.joined_at;

    const lastReadAt = latestReadAt(
      sameMembership ? old.last_read_at : null,
      latestReadAt(
        member.last_read_at,
        pendingReceipts.get(member.user_id)
      )
    );

    const profile =
      old && sameProfile(old.profile, member.profile)
        ? old.profile
        : member.profile;

    if (
      old &&
      sameMembership &&
      old.last_read_at === lastReadAt &&
      old.profile === profile
    ) {
      return old;
    }

    return {
      ...member,
      last_read_at: lastReadAt,
      profile,
    };
  });

  return (
    previous.length === next.length &&
    next.every((member, index) =>
      member === previous[index]
    )
  )
    ? previous
    : next;
}

/* -------------------- HOOK -------------------- */

export default function useConversationMembers(
  conversationId,
  userId,
  enabled = true
) {
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (!conversationId || !userId || !enabled) {
      return;
    }

    let active = true;
    let connected = false;
    let request = null;
    let refreshPending = false;

    const pendingReceipts = new Map();

    /* -------------------- REFRESH -------------------- */

    function refresh({ force = false } = {}) {
      if (!active) return;

      if (request) {
        if (force) {
          refreshPending = true;
        }

        return request.promise;
      }

      const controller = new AbortController();

      const currentRequest = {
        controller,
        promise: null,
      };

      request = currentRequest;

      currentRequest.promise = Promise.resolve()
        .then(async () => {
          do {
            refreshPending = false;

            if (!active) return;

            try {
              const incoming =
                await getConversationMembers(
                  conversationId,
                  controller.signal
                );

              if (
                !active ||
                controller.signal.aborted
              ) {
                return;
              }

              const receipts = new Map(
                pendingReceipts
              );

              pendingReceipts.clear();

              setSnapshot((current) => {
                const sameSession =
                  current?.conversationId ===
                  conversationId &&
                  current?.userId === userId;

                const previous = sameSession
                  ? current.members
                  : EMPTY_MEMBERS;

                const members = reconcileMembers(
                  previous,
                  incoming,
                  receipts
                );

                if (
                  sameSession &&
                  current.members === members &&
                  !current.error
                ) {
                  return current;
                }

                return {
                  conversationId,
                  userId,
                  members,
                  error: null,
                };
              });
            } catch (error) {
              if (
                !active ||
                controller.signal.aborted
              ) {
                return;
              }

              setSnapshot((current) => ({
                conversationId,
                userId,
                members:
                  current?.conversationId ===
                    conversationId &&
                    current?.userId === userId
                    ? current.members
                    : EMPTY_MEMBERS,
                error:
                  error?.message ||
                  "Unable to load conversation members",
              }));
            }
          } while (active && refreshPending);
        })
        .finally(() => {
          if (request === currentRequest) {
            request = null;
          }
        });

      return currentRequest.promise;
    }

    /* -------------------- REALTIME -------------------- */

    function handleReceipt(member) {
      if (
        !active ||
        member?.conversation_id !== conversationId ||
        !member.user_id ||
        !getTimestamp(member.last_read_at)
      ) {
        return;
      }

      if (request) {
        pendingReceipts.set(
          member.user_id,
          latestReadAt(
            pendingReceipts.get(member.user_id),
            member.last_read_at
          )
        );
      }

      setSnapshot((current) => {
        if (
          current?.conversationId !== conversationId ||
          current?.userId !== userId
        ) {
          return current;
        }

        const index = current.members.findIndex(
          (item) => item.user_id === member.user_id
        );

        if (index === -1) {
          return current;
        }

        const previous = current.members[index];

        const lastReadAt = latestReadAt(
          previous.last_read_at,
          member.last_read_at
        );

        if (
          lastReadAt === previous.last_read_at
        ) {
          return current;
        }

        const members = [...current.members];

        members[index] = {
          ...previous,
          last_read_at: lastReadAt,
        };

        return {
          ...current,
          members,
        };
      });
    }

    function handleStatus(status) {
      if (!active) return;

      if (status === "SUBSCRIBED") {
        connected = true;

        void refresh({ force: true });

        return;
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        connected = false;
      }
    }

    const unsubscribe = subscribeToReadReceipts(
      conversationId,
      handleReceipt,
      handleStatus
    );

    /* -------------------- BROWSER EVENTS -------------------- */

    const unsubscribeVisibility =
      subscribePageVisibility(() => {
        if (active && getPageVisible()) {
          void refresh();
        }
      });

    function handleOnline() {
      if (
        active &&
        !connected &&
        getPageVisible()
      ) {
        void refresh();
      }
    }

    window.addEventListener(
      "online",
      handleOnline
    );

    void refresh();

    /* -------------------- CLEANUP -------------------- */

    return () => {
      active = false;
      refreshPending = false;

      request?.controller.abort();

      pendingReceipts.clear();

      unsubscribe();
      unsubscribeVisibility();

      window.removeEventListener(
        "online",
        handleOnline
      );
    };
  }, [conversationId, userId, enabled]);

    /* -------------------- DERIVED STATE -------------------- */

  const current =
    enabled &&
    snapshot?.conversationId === conversationId &&
    snapshot?.userId === userId
      ? snapshot
      : null;

  const members = current?.members ?? EMPTY_MEMBERS;

  const otherMembers = useMemo(
    () =>
      members.length
        ? members.filter(
            (member) => member.user_id !== userId
          )
        : EMPTY_MEMBERS,
    [members, userId]
  );

  const profiles = useMemo(() => {
    if (!members.length) {
      return EMPTY_PROFILES;
    }

    return Object.fromEntries(
      members
        .filter((member) => member.profile)
        .map((member) => [
          member.user_id,
          member.profile,
        ])
    );
  }, [members]);

  const receiptMembers = useMemo(() => {
    if (!otherMembers.length) {
      return EMPTY_MEMBERS;
    }

    return otherMembers.map((member) => ({
      userId: member.user_id,

      name:
        member.profile?.display_name ||
        member.profile?.username ||
        "Member",

      joinedTime: getTimestamp(member.joined_at),

      readTime: getTimestamp(member.last_read_at),
    }));
  }, [otherMembers]);

  const recipientReadTime =
    receiptMembers.length === 1
      ? receiptMembers[0].readTime
      : 0;

  return {
    members,
    otherMembers,
    profiles,
    receiptMembers,
    recipientReadTime,

    loading: Boolean(
      enabled &&
      conversationId &&
      userId &&
      !current
    ),

    error: current?.error ?? null,
  };
}