// src/lib/blocks.js

import { createClient } from "@/lib/supabase/client";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -------------------- VALIDATION -------------------- */

function validateId(value, label = "User ID") {
  if (
    typeof value !== "string" ||
    !UUID_PATTERN.test(value)
  ) {
    throw new Error(`Invalid ${label.toLowerCase()}`);
  }

  return value;
}

/* -------------------- RPC HELPER -------------------- */

async function executeRpc(functionName, parameters) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc(
    functionName,
    parameters
  );

  if (error) {
    throw error;
  }

  return data;
}

/* -------------------- BLOCK USER -------------------- */

export async function blockUser(userId) {
  const targetUserId = validateId(userId);

  const result = await executeRpc("block_user", {
    target_user_id: targetUserId,
  });

  if (result !== true) {
    throw new Error("Failed to block user");
  }

  return true;
}

/* -------------------- UNBLOCK USER -------------------- */

export async function unblockUser(userId) {
  const targetUserId = validateId(userId);

  const result = await executeRpc("unblock_user", {
    target_user_id: targetUserId,
  });

  if (result !== true) {
    throw new Error("Failed to unblock user");
  }

  return true;
}

/* -------------------- BLOCK STATUS -------------------- */

export async function isUserBlocked(userId) {
  const targetUserId = validateId(userId);

  const result = await executeRpc("is_user_blocked", {
    target_user_id: targetUserId,
  });

  return result === true;
}

/* -------------------- BLOCKED USERS -------------------- */

export async function getBlockedUsers() {
  const result = await executeRpc("get_blocked_users");

  return result ?? [];
}

/* -------------------- MESSAGING PERMISSION -------------------- */

export async function canSendChatMessage(conversationId) {
  const chatId = validateId(
    conversationId,
    "Conversation ID"
  );

  const result = await executeRpc(
    "can_send_chat_message",
    {
      chat_id: chatId,
    }
  );

  return result === true;
}

/* -------------------- PRESENCE RESTRICTIONS -------------------- */

export async function getRestrictedUserIds() {
  const result = await executeRpc(
    "get_restricted_user_ids"
  );

  if (!Array.isArray(result)) {
    throw new Error(
      "Invalid restricted users response"
    );
  }

  return result;
}