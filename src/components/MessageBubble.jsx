// src/components/MessageBubble.jsx

"use client";

import {
  memo,
  useCallback,
  useMemo,
  useState,
  useId,
} from "react";

import {
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Reply,
} from "lucide-react";

import { getPreviewUrlFromParts } from "@/utils/previewUrlPolicy";
import { splitMessageText } from "@/utils/urlUtils";
import {
  highlightMentionParts,
} from "@/utils/messageUtils";
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
  userId,
}) {
  return (
    <p
      className={`whitespace-pre-wrap wrap-break-word [overflow-wrap:anywhere] text-sm ${hasMedia ? "mt-2" : ""
        }`}
    >
      {parts.map((part, index) => {
        if (part.type === "link") {
          return (
            <a
              key={index}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline underline-offset-2 transition-colors ${isOwn
                ? "text-white hover:text-blue-200"
                : "text-blue-400 hover:text-blue-300"
                }`}
            >
              {part.value}
            </a>
          );
        }

        if (part.type === "mention") {
          const mentionsMe =
            part.userId === userId;

          return (
            <span
              key={index}
              title={
                mentionsMe
                  ? "Mentioned you"
                  : `Mentioned @${part.username}`
              }
              className={`rounded px-0.5 font-semibold ${mentionsMe
                ? "bg-amber-400/20 text-amber-300"
                : isOwn
                  ? "bg-white/15 text-white"
                  : "bg-blue-500/15 text-blue-300"
                }`}
            >
              {part.value}
            </span>
          );
        }

        return part.value;
      })}
    </p>
  );
});

/* -------------------- MESSAGE STATUS -------------------- */

const MessageStatus = memo(function MessageStatus({
  createdAt,
  isOwn,
  isRead,
  showReadStatus,
  groupReadCount,
  groupRecipientCount,
  receiptMembers = EMPTY_PARTS,
}) {
  const [expanded, setExpanded] = useState(false);

  const detailsId = useId();

  const time = useMemo(() => {
    const date = new Date(createdAt);

    return Number.isNaN(date.getTime())
      ? ""
      : TIME_FORMATTER.format(date);
  }, [createdAt]);

  const hasGroupReceipts =
    isOwn &&
    Number.isInteger(groupReadCount) &&
    Number.isInteger(groupRecipientCount) &&
    groupRecipientCount > 0;

  const allRead =
    hasGroupReceipts &&
    groupReadCount === groupRecipientCount;

  const receiptDetails = useMemo(() => {
    if (!expanded || !hasGroupReceipts) {
      return EMPTY_PARTS;
    }

    const messageTime = Date.parse(createdAt);

    return receiptMembers
      .filter(
        (member) =>
          member.joinedTime > 0 &&
          member.joinedTime <= messageTime
      )
      .map((member) => ({
        userId: member.userId,
        name: member.name,

        hasRead:
          member.readTime > 0 &&
          member.readTime >= messageTime,
      }))
      .sort(
        (a, b) =>
          Number(b.hasRead) - Number(a.hasRead) ||
          a.name.localeCompare(b.name)
      );
  }, [
    expanded,
    hasGroupReceipts,
    receiptMembers,
    createdAt,
  ]);

  return (
    <div className="mt-1 min-w-0">
      <div
        className={`flex flex-wrap items-center justify-end gap-1 text-[11px] ${isOwn
            ? "text-blue-200"
            : "text-gray-400"
          }`}
      >
        <time dateTime={createdAt}>
          {time}
        </time>

        {isOwn && showReadStatus && (
          isRead ? (
            <CheckCheck
              size={15}
              className="text-cyan-300"
              aria-label="Read"
            />
          ) : (
            <Check
              size={15}
              aria-label="Sent"
            />
          )
        )}

        {hasGroupReceipts && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={
              expanded ? detailsId : undefined
            }
            onClick={() =>
              setExpanded((value) => !value)
            }
            title="View group read receipts"
            className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            {groupReadCount > 0 ? (
              <CheckCheck
                size={15}
                aria-hidden="true"
                className={
                  allRead
                    ? "text-cyan-300"
                    : ""
                }
              />
            ) : (
              <Check
                size={15}
                aria-hidden="true"
              />
            )}

            <span>
              Seen by {groupReadCount} of{" "}
              {groupRecipientCount}
            </span>

            <ChevronDown
              size={12}
              aria-hidden="true"
              className={`transition-transform motion-reduce:transition-none ${expanded
                  ? "rotate-180"
                  : ""
                }`}
            />
          </button>
        )}
      </div>

      {hasGroupReceipts && expanded && (
        <div
          id={detailsId}
          className="mt-2 min-w-0 rounded-xl border border-white/15 bg-black/15 p-2.5"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">
              Read receipts
            </span>

            <span className="text-[11px] text-blue-200">
              {groupReadCount}/{groupRecipientCount}
            </span>
          </div>

          <ul className="max-h-56 space-y-1 overflow-y-auto overscroll-contain">
            {receiptDetails.map((member) => (
              <li
                key={member.userId}
                className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1.5"
              >
                <div
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white"
                >
                  {Array.from(
                    member.name.trim()
                  )[0]?.toUpperCase() || "?"}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white">
                    {member.name}
                  </p>

                  <p className="text-[10px] text-blue-200">
                    {member.hasRead
                      ? "Seen"
                      : "Not seen yet"}
                  </p>
                </div>

                {member.hasRead ? (
                  <CheckCheck
                    size={15}
                    aria-hidden="true"
                    className="shrink-0 text-cyan-300"
                  />
                ) : (
                  <Clock
                    size={14}
                    aria-hidden="true"
                    className="shrink-0 text-blue-200"
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
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
  groupReadCount,
  groupRecipientCount,
  receiptMembers,
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
    mentions,
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
  const mentionsMe = !isOwn && Array.isArray(mentions) && mentions.some((mention) => mention?.user_id === userId);
  const hasAttachment = Boolean(attachmentPath) && (attachmentType === "image" || attachmentType === "file");
  const hasMedia = Boolean(gifId) || hasAttachment;

  /* Parse message content once. */

  /* -------------------- MESSAGE CONTENT -------------------- */

  const { parts, previewUrl } = useMemo(() => {
    if (!content?.trim()) {
      return {
        parts: EMPTY_PARTS,
        previewUrl: null,
      };
    }

    const textParts = splitMessageText(content);

    return {
      parts: highlightMentionParts(
        textParts,
        mentions
      ),

      previewUrl: getPreviewUrlFromParts(
        textParts
      ),
    };
  }, [content, mentions]);

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
      className={`group flex min-w-0 items-center gap-1 sm:gap-2 ${isOwn ? "justify-end" : "justify-start"
        }`}
    >
      {hasActions && (
        <div
          className={`flex shrink-0 items-center transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${isOwn ? "order-first" : "order-last"
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
        className={`min-w-0 ${widthClass} sm:max-w-[75%] ${previewUrl ? "w-96" : ""
          }`}
      >
        <div
          className={`min-w-0 rounded-2xl px-4 py-2.5 ${isOwn
            ? "rounded-br-sm bg-blue-600 text-white"
            : "rounded-bl-sm bg-gray-800 text-gray-100"
            } ${mentionsMe
              ? "ring-1 ring-amber-400/50"
              : ""
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
              userId={userId}
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
            groupReadCount={groupReadCount}
            groupRecipientCount={groupRecipientCount}
            receiptMembers={receiptMembers}
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