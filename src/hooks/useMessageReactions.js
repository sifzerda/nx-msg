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

const EMPTY_REACTIONS = [];
const EMPTY_MAP = new Map();

function applyChange(reactions, change) {
  const { operation, reaction } = change;

  if (!reaction?.id) return reactions;

  if (operation === "DELETE") {
    if (!reactions.some((item) => item.id === reaction.id)) {
      return reactions;
    }

    return reactions.filter(
      (item) => item.id !== reaction.id
    );
  }

  if (operation === "INSERT") {
    if (reactions.some((item) => item.id === reaction.id)) {
      return reactions;
    }

    return [...reactions, reaction];
  }

  return reactions;
}

export default function useMessageReactions(
  conversationId,
  userId,
  messages
) {
  const [state, setState] = useState({
    conversationId: null,
    reactions: [],
  });

  const [error, setError] = useState(null);

  const sessionRef = useRef(null);

  const reactions =
    state.conversationId === conversationId
      ? state.reactions
      : EMPTY_REACTIONS;

  const messageIds = useMemo(
    () => messages.map((message) => message.id),
    [messages]
  );

  const messageKey = useMemo(
    () => [...messageIds].sort().join(","),
    [messageIds]
  );

  // Maintain one subscription per conversation.
  useEffect(() => {
    if (!conversationId || !userId) return;

    let unsubscribe = null;

    const session = {
      active: true,
      conversationId,
      ids: new Set(),
      pending: new Set(),
      changes: [],
      requestId: 0,
      loading: false,
      refresh: null,
    };

    sessionRef.current = session;

    setState({
      conversationId,
      reactions: [],
    });

    setError(null);

    function updateReactions(change) {
      if (!session.active) return;

      if (
        !session.ids.has(
          change.reaction.message_id
        )
      ) {
        return;
      }

      // Preserve changes arriving during a fetch.
      if (session.loading) {
        session.changes.push(change);
      }

      setState((current) => {
        if (
          current.conversationId !== conversationId
        ) {
          return current;
        }

        const next = applyChange(
          current.reactions,
          change
        );

        if (next === current.reactions) {
          return current;
        }

        return {
          conversationId,
          reactions: next,
        };
      });
    }

    async function refresh() {
      if (!session.active) return;

      const requestId = ++session.requestId;
      const ids = [...session.ids];

      session.loading = true;
      session.changes = [];

      try {
        let result = await getReactions(
          conversationId,
          ids
        );

        if (
          !session.active ||
          requestId !== session.requestId
        ) {
          return;
        }

        // Replay changes received while loading.
        for (const change of session.changes) {
          result = applyChange(result, change);
        }

        setState({
          conversationId,
          reactions: result,
        });

        setError(null);
      } catch (error) {
        if (
          session.active &&
          requestId === session.requestId
        ) {
          setError(
            error.message ||
              "Failed to load reactions"
          );
        }
      } finally {
        if (requestId === session.requestId) {
          session.loading = false;
          session.changes = [];
        }
      }
    }

    session.refresh = refresh;
    session.updateReactions = updateReactions;

    async function connect() {
      try {
        const cleanup = await subscribeToReactions({
          conversationId,

          onChange: updateReactions,

          onStatus: (status) => {
            if (
              session.active &&
              status === "SUBSCRIBED"
            ) {
              void refresh();
            }
          },
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

    void connect();

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      session.active = false;

      unsubscribe?.();

      session.pending.clear();
      session.changes = [];

      if (sessionRef.current === session) {
        sessionRef.current = null;
      }

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [conversationId, userId]);

  // Refresh when the visible message IDs change.
  useEffect(() => {
    const session = sessionRef.current;

    if (
      !session ||
      session.conversationId !== conversationId
    ) {
      return;
    }

    session.ids = new Set(
      messageKey ? messageKey.split(",") : []
    );

    void session.refresh();
  }, [conversationId, userId, messageKey]);

  // Group reactions by message ID.
  const reactionsByMessage = useMemo(() => {
    if (!reactions.length) {
      return EMPTY_MAP;
    }

    const grouped = new Map();

    for (const reaction of reactions) {
      let items = grouped.get(reaction.message_id);

      if (!items) {
        items = [];
        grouped.set(reaction.message_id, items);
      }

      items.push(reaction);
    }

    return grouped;
  }, [reactions]);

  const toggleReaction = useCallback(
    async (messageId, emoji) => {
      const session = sessionRef.current;

      if (
        !session?.active ||
        session.conversationId !== conversationId ||
        !session.ids.has(messageId) ||
        !userId
      ) {
        return;
      }

      const key = `${messageId}:${emoji}`;

      if (session.pending.has(key)) return;

      session.pending.add(key);
      setError(null);

      const existing = reactions.find(
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

          if (session.active) {
            session.updateReactions({
              operation: "DELETE",
              reaction: existing,
            });
          }
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
            // Another session may already have
            // inserted the same reaction.
            await session.refresh();
          }
        }
      } catch (error) {
        if (session.active) {
          setError(
            error.message ||
              "Failed to update reaction"
          );
        }
      } finally {
        session.pending.delete(key);
      }
    },
    [conversationId, userId, reactions]
  );

  return {
    reactionsByMessage,
    toggleReaction,
    reactionError: error,
  };
}
