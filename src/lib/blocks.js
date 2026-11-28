// src/lib/blocks.js

import { createClient } from "@/lib/supabase/client";
import { isUuid } from "@/utils/validation";

/* -------------------- VALIDATION -------------------- */

function validateId(value, label = "User ID") {
  if (!isUuid(value)) {
    throw new Error(`Invalid ${label.toLowerCase()}`);
  }

  return value;
}

/* -------------------- RPC HELPER -------------------- */

async function executeRpc(functionName, parameters) {
  const { data, error } = await createClient().rpc(
    functionName,
    parameters
  );

  if (error) throw error;

  return data;
}

/* -------------------- BLOCK USER -------------------- */

export async function blockUser(userId) {
  const result = await executeRpc("block_user", {
    target_user_id: validateId(userId),
  });

  if (result !== true) {
    throw new Error("Failed to block user");
  }

  return true;
}

/* -------------------- UNBLOCK USER -------------------- */

export async function unblockUser(userId) {
  const result = await executeRpc("unblock_user", {
    target_user_id: validateId(userId),
  });

  if (result !== true) {
    throw new Error("Failed to unblock user");
  }

  return true;
}

/* -------------------- BLOCKED USERS -------------------- */

export async function getBlockedUsers() {
  return (await executeRpc("get_blocked_users")) ?? [];
}

/* -------------------- PRESENCE RESTRICTIONS -------------------- */

export async function getRestrictedUserIds() {
  const result = await executeRpc("get_restricted_user_ids");

  if (!Array.isArray(result)) {
    throw new Error("Invalid restricted users response");
  }

  return result;
}