// src/hooks/useCurrentDay.js

"use client";

import { useSyncExternalStore } from "react";

import { getDateKey } from "@/utils/messageUtils";

import {
  scheduleBrowserTask,
  subscribePageVisibility,
  getPageVisible,
} from "@/hooks/useBrowser";

const listeners = new Set();

let currentDay = null;
let currentKey = null;

let cancelMidnight = null;
let unsubscribeVisibility = null;

const SERVER_SNAPSHOT = null;

/* -------------------- SNAPSHOTS -------------------- */

function getSnapshot() {
  if (!currentDay) {
    currentDay = new Date();
    currentKey = getDateKey(currentDay);
  }

  return currentDay;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

/* -------------------- DATE UPDATES -------------------- */

function notifyListeners() {
  for (const listener of [...listeners]) {
    listener();
  }
}

function refreshDay() {
  const now = new Date();
  const key = getDateKey(now);

  if (currentKey !== key) {
    currentDay = now;
    currentKey = key;

    notifyListeners();
  }
}

function scheduleMidnight() {
  cancelMidnight?.();
  cancelMidnight = null;

  if (!listeners.size) return;

  const midnight = new Date();

  midnight.setHours(24, 0, 0, 100);

  cancelMidnight = scheduleBrowserTask(
    () => {
      cancelMidnight = null;

      refreshDay();
      scheduleMidnight();
    },
    midnight.getTime()
  );
}

function handleVisibility() {
  if (!getPageVisible()) return;

  refreshDay();
  scheduleMidnight();
}

/* -------------------- SUBSCRIPTION -------------------- */

function subscribe(listener) {
  listeners.add(listener);

  if (listeners.size === 1) {
    unsubscribeVisibility =
      subscribePageVisibility(handleVisibility);

    refreshDay();
    scheduleMidnight();
  }

  return () => {
    listeners.delete(listener);

    if (!listeners.size) {
      cancelMidnight?.();
      cancelMidnight = null;

      unsubscribeVisibility?.();
      unsubscribeVisibility = null;
    }
  };
}

/* -------------------- PUBLIC HOOK -------------------- */

export default function useCurrentDay() {
  const now = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return now;
}