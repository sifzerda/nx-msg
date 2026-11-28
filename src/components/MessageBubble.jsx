// src/components/MessageBubble.jsx

"use client";

import { memo, useCallback, useMemo } from "react";
import { Check, CheckCheck, Reply } from "lucide-react";

import { getPreviewUrlFromParts } from "@/utils/previewUrlPolicy";
import { splitMessageText } from "@/utils/urlUtils";

import { QuotedMessage } from "./MessageReply";

import MessageReactions, {
  ReactionPicker,
  groupReactions,
} from "./MessageReactions";

import MessageAttachment from "./extras/MessageAttachment";
import GifMessage from "./extras/GifMessage";
import LinkPreview from "./extras/LinkPreview";

const EMPTY_REACTIONS = Object.freeze([]);
const EMPTY_PARTS = Object.freeze([]);

const TIME_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
});

/* -------------------- MESSAGE TEXT -------------------- */

const MessageText = memo(function MessageText({
  parts,
  isOwn,
  hasMedia,
}) {
  return (
    <p
      className={`whitespace-pre-wrap wrap-break-word [overflow-wrap:anywhere] text-sm ${
        hasMedia ? "mt-2" : ""
      }`}
    >
      {parts.map((part, index) =>
        part.type === "link" ? (
          <a
            key={index}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline underline-offset-2 transition-colors ${
              isOwn
                ? "text-white hover:text-blue-200"
                : "text-blue-400 hover:text-blue-300"
            }`}
          >
            {part.value}
          </a>
        ) : (
          part.value
        )
      )}
    </p>
  );
});

/* -------------------- TIMESTAMP -------------------- */

const MessageStatus = memo(function MessageStatus({
  createdAt,
  isOwn,
  isRead,
  showReadStatus,
}) {
  const time = useMemo(() => {
    const date = new Date(createdAt);

    return Number.isNaN(date.getTime())
      ? ""
      : TIME_FORMATTER.format(date);
  }, [createdAt]);

  return (
    <div
      className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${
        isOwn ? "text-blue-200" : "text-gray-400"
      }`}
    >
      <time dateTime={createdAt}>{time}</time>

      {isOwn && showReadStatus && (
        isRead ? (
          <CheckCheck
            size={15}
            className="text-cyan-300"
            aria-label="Read"
          />
        ) : (
          <Check size={15} aria-label="Sent" />
        )
      )}
    </div>
  );
});

/* -------------------- MESSAGE BUBBLE -------------------- */

function MessageBubble({
  message,
  isOwn,
  isRead,
  showReadStatus = true,
  quotedMessage,
  quotedSenderName,
  onReply,
  onJumpToMessage,
  reactions = EMPTY_REACTIONS,
  userId,
  onToggleReaction,
}) {
  const {
    id,
    content,
    created_at: createdAt,
    reply_to_id: replyToId,
    gif_id: gifId,
    attachment_type: attachmentType,
    attachment_path: attachmentPath,
    attachment_name: attachmentName,
    attachment_size: attachmentSize,
  } = message;

  const canReply = typeof onReply === "function";
  const canReact = typeof onToggleReaction === "function";
  const hasActions = canReply || canReact;

  const hasAttachment =
    Boolean(attachmentPath) &&
    (attachmentType === "image" ||
      attachmentType === "file");

  const hasMedia = Boolean(gifId) || hasAttachment;

  /* Parse message content once. */

  const { parts, previewUrl } = useMemo(() => {
    if (!content?.trim()) {
      return {
        parts: EMPTY_PARTS,
        previewUrl: null,
      };
    }

    const parts = splitMessageText(content);

    return {
      parts,
      previewUrl: getPreviewUrlFromParts(parts),
    };
  }, [content]);

  const reactionGroups = useMemo(
    () => groupReactions(reactions, userId),
    [reactions, userId]
  );

  const handleReaction = useCallback(
    (emoji) => onToggleReaction?.(id, emoji),
    [id, onToggleReaction]
  );

  const handleReply = useCallback(
    () => onReply?.(message),
    [message, onReply]
  );

  const handleJump = useCallback(() => {
    if (replyToId) {
      onJumpToMessage?.(replyToId);
    }
  }, [replyToId, onJumpToMessage]);

  const widthClass =
    canReply && canReact
      ? "max-w-[calc(100%-80px)]"
      : hasActions
        ? "max-w-[calc(100%-44px)]"
        : "max-w-full";

  return (
    <div
      className={`group flex min-w-0 items-center gap-1 sm:gap-2 ${
        isOwn ? "justify-end" : "justify-start"
      }`}
    >
      {hasActions && (
        <div
          className={`flex shrink-0 items-center transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${
            isOwn ? "order-first" : "order-last"
          }`}
        >
          {canReact && (
            <ReactionPicker
              isOwn={isOwn}
              groups={reactionGroups}
              onSelect={handleReaction}
            />
          )}

          {canReply && (
            <button
              type="button"
              onClick={handleReply}
              aria-label="Reply to message"
              title="Reply to message"
              className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-blue-400"
            >
              <Reply size={17} />
            </button>
          )}
        </div>
      )}

      <div
        className={`min-w-0 ${widthClass} sm:max-w-[75%] ${
          previewUrl ? "w-96" : ""
        }`}
      >
        <div
          className={`min-w-0 rounded-2xl px-4 py-2.5 ${
            isOwn
              ? "rounded-br-sm bg-blue-600 text-white"
              : "rounded-bl-sm bg-gray-800 text-gray-100"
          }`}
        >
          {replyToId && (
            <QuotedMessage
              message={quotedMessage}
              senderName={quotedSenderName}
              isOwn={isOwn}
              onClick={
                quotedMessage && onJumpToMessage
                  ? handleJump
                  : undefined
              }
            />
          )}

          {gifId && (
            <GifMessage
              key={gifId}
              gifId={gifId}
            />
          )}

          {hasAttachment && (
            <MessageAttachment
              type={attachmentType}
              path={attachmentPath}
              name={attachmentName}
              size={attachmentSize}
              userId={userId}
            />
          )}

          {parts.length > 0 && (
            <MessageText
              parts={parts}
              isOwn={isOwn}
              hasMedia={hasMedia}
            />
          )}

          {previewUrl && userId && (
            <LinkPreview
              messageId={id}
              userId={userId}
              url={previewUrl}
            />
          )}

          <MessageStatus
            createdAt={createdAt}
            isOwn={isOwn}
            isRead={isRead}
            showReadStatus={showReadStatus}
          />
        </div>

        {reactionGroups.length > 0 && (
          <MessageReactions
            groups={reactionGroups}
            isOwn={isOwn}
            onToggle={
              canReact ? handleReaction : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);