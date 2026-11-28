// src/hooks/useMessageReactions.js

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getReactions,
  addReaction,
  removeReaction,
  subscribeToReactions,
} from "@/lib/extras/reactions";

const EMPTY_REACTIONS = Object.freeze([]);
const EMPTY_MAP = new Map();

function applyChange(reactions, change) {
  const { operation, reaction } = change;

  if (!reaction?.id) return reactions;

  const exists = reactions.some(
    (item) => item.id === reaction.id
  );

  if (operation === "DELETE" && exists) {
    return reactions.filter(
      (item) => item.id !== reaction.id
    );
  }

  if (operation === "INSERT" && !exists) {
    return [...reactions, reaction];
  }

  return reactions;
}

export default function useMessageReactions(
  conversationId,
  userId,
  messages
) {
  const [state, setState] = useState(null);
  const [errorState, setErrorState] = useState(null);

  const sessionRef = useRef(null);

  const scope =
    conversationId && userId
      ? `${conversationId}:${userId}`
      : null;

  const reactions =
    scope && state?.scope === scope
      ? state.reactions
      : EMPTY_REACTIONS;

  const reactionError =
    scope && errorState?.scope === scope
      ? errorState.message
      : null;

  const messageKey = useMemo(
    () =>
      [...new Set(
        messages.map((message) => message.id)
      )]
        .sort()
        .join(","),
    [messages]
  );

  /* -------------------- SESSION -------------------- */

  useEffect(() => {
    if (!conversationId || !userId) return;

    let unsubscribe = null;
    let connected = false;

    const session = {
      active: true,
      scope,
      ids: new Set(),
      pending: new Set(),
      reactions: EMPTY_REACTIONS,
      changes: [],
      request: null,
      refreshPending: false,
      loading: false,
      refresh,
      updateReactions,
      setError,
      setMessageIds,
    };

    sessionRef.current = session;

    /* -------------------- STATE -------------------- */

    function publish(reactions) {
      if (
        !session.active ||
        session.reactions === reactions
      ) {
        return;
      }

      session.reactions = reactions;

      setState({
        scope,
        reactions,
      });
    }

    function setError(message) {
      if (!session.active) return;

      setErrorState((current) => {
        if (
          current?.scope === scope &&
          current.message === message
        ) {
          return current;
        }

        return {
          scope,
          message,
        };
      });
    }

    /* -------------------- REALTIME CHANGES -------------------- */

    function updateReactions(change) {
      if (
        !session.active ||
        !session.ids.has(
          change?.reaction?.message_id
        )
      ) {
        return;
      }

      if (session.loading) {
        session.changes.push(change);
      }

      publish(
        applyChange(
          session.reactions,
          change
        )
      );
    }

    /* -------------------- REFRESH -------------------- */

    function refresh({ force = false } = {}) {
      if (!session.active) {
        return Promise.resolve(false);
      }

      if (session.request) {
        if (force) {
          session.refreshPending = true;
        }

        return session.request;
      }

      const request = Promise.resolve()
        .then(async () => {
          let success = false;

          do {
            if (!session.active) return false;

            session.refreshPending = false;

            const ids = [...session.ids];

            if (!ids.length) {
              publish(EMPTY_REACTIONS);
              setError(null);

              return true;
            }

            session.loading = true;
            session.changes = [];

            try {
              let result = await getReactions(
                conversationId,
                ids
              );

              if (!session.active) return false;

              for (const change of session.changes) {
                result = applyChange(
                  result,
                  change
                );
              }

              // Message IDs may have changed
              // while the request was running.
              result = result.filter(
                (reaction) =>
                  session.ids.has(
                    reaction.message_id
                  )
              );

              publish(
                result.length
                  ? result
                  : EMPTY_REACTIONS
              );

              setError(null);

              success = true;
            } catch (error) {
              if (session.active) {
                setError(
                  error?.message ||
                    "Failed to load reactions"
                );
              }

              success = false;
            } finally {
              session.loading = false;
              session.changes = [];
            }
          } while (
            session.active &&
            session.refreshPending
          );

          return success;
        })
        .finally(() => {
          if (session.request === request) {
            session.request = null;
          }
        });

      session.request = request;

      return request;
    }

    /* -------------------- MESSAGE IDS -------------------- */

    function setMessageIds(ids) {
      const previous = session.ids;

      const hasAddedMessages = [...ids].some(
        (id) => !previous.has(id)
      );

      const hasRemovedMessages = [...previous].some(
        (id) => !ids.has(id)
      );

      session.ids = ids;

      if (hasRemovedMessages) {
        const remaining =
          session.reactions.filter(
            (reaction) =>
              ids.has(reaction.message_id)
          );

        if (
          remaining.length !==
          session.reactions.length
        ) {
          publish(
            remaining.length
              ? remaining
              : EMPTY_REACTIONS
          );
        }
      }

      if (hasAddedMessages) {
        void refresh({ force: true });
      }
    }

    /* -------------------- CONNECTION -------------------- */

    function handleStatus(status) {
      if (!session.active) return;

      if (status === "SUBSCRIBED") {
        if (connected) return;

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

    async function connect() {
      try {
        const cleanup =
          await subscribeToReactions({
            conversationId,
            onChange: updateReactions,
            onStatus: handleStatus,
          });

        if (!session.active) {
          cleanup();
          return;
        }

        unsubscribe = cleanup;
      } catch (error) {
        if (session.active) {
          console.error(
            "Reaction connection failed:",
            error
          );
        }
      }
    }

    /* -------------------- BROWSER EVENTS -------------------- */

    function handleVisibility() {
      if (
        session.active &&
        document.visibilityState === "visible"
      ) {
        void refresh();
      }
    }

    function handleOnline() {
      if (
        session.active &&
        document.visibilityState === "visible"
      ) {
        void refresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    window.addEventListener(
      "online",
      handleOnline
    );

    void connect();

    /* -------------------- CLEANUP -------------------- */

    return () => {
      session.active = false;
      session.refreshPending = false;

      unsubscribe?.();

      session.pending.clear();
      session.ids.clear();
      session.changes = [];

      if (sessionRef.current === session) {
        sessionRef.current = null;
      }

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      window.removeEventListener(
        "online",
        handleOnline
      );
    };
  }, [conversationId, userId, scope]);

  /* -------------------- MESSAGE CHANGES -------------------- */

  useEffect(() => {
    const session = sessionRef.current;

    if (
      !session?.active ||
      session.scope !== scope
    ) {
      return;
    }

    session.setMessageIds(new Set(messageKey ? messageKey.split(",") : []));
  }, [scope, messageKey]);

  /* -------------------- GROUP REACTIONS -------------------- */

  const reactionsByMessage = useMemo(() => {
    if (!reactions.length) {
      return EMPTY_MAP;
    }

    const grouped = new Map();

    for (const reaction of reactions) {
      const id = reaction.message_id;

      let items = grouped.get(id);

      if (!items) {
        items = [];
        grouped.set(id, items);
      }

      items.push(reaction);
    }

    return grouped;
  }, [reactions]);

  /* -------------------- TOGGLE REACTION -------------------- */

  const toggleReaction = useCallback(
    async (messageId, emoji) => {
      const session = sessionRef.current;

      if (
        !session?.active ||
        session.scope !== scope ||
        !session.ids.has(messageId) ||
        !userId
      ) {
        return;
      }

      const key = `${messageId}:${emoji}`;

      if (session.pending.has(key)) return;

      session.pending.add(key);
      session.setError(null);

      const existing = session.reactions.find(
        (reaction) =>
          reaction.message_id === messageId &&
          reaction.user_id === userId &&
          reaction.emoji === emoji
      );

      try {
        if (existing) {
          await removeReaction({
            conversationId,
            messageId,
            userId,
            emoji,
          });

          if (!session.active) return;

          session.updateReactions({
            operation: "DELETE",
            reaction: existing,
          });
        } else {
          const reaction = await addReaction({
            conversationId,
            messageId,
            userId,
            emoji,
          });

          if (!session.active) return;

          if (reaction) {
            session.updateReactions({
              operation: "INSERT",
              reaction,
            });
          } else {
            await session.refresh({
              force: true,
            });
          }
        }
      } catch (error) {
        if (session.active) {
          session.setError(error?.message || "Failed to update reaction");
        }
      } finally {
        session.pending.delete(key);
      }
    },
    [conversationId, userId, scope]
  );

  return {
    reactionsByMessage,
    toggleReaction,
    reactionError,
  };
}