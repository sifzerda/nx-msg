// src/hooks/useBrowser.js

"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const noop = () => {};
const getServerSnapshot = () => false;

/* -------------------- PAGE VISIBILITY -------------------- */

const visibilityListeners = new Set();

export function getPageVisible() {
  return (
    typeof document !== "undefined" &&
    document.visibilityState === "visible"
  );
}

function notifyVisibility() {
  for (const listener of [...visibilityListeners]) {
    listener();
  }
}

export function subscribePageVisibility(listener) {
  if (typeof document === "undefined") {
    return noop;
  }

  visibilityListeners.add(listener);

  if (visibilityListeners.size === 1) {
    document.addEventListener(
      "visibilitychange",
      notifyVisibility
    );
  }

  return () => {
    visibilityListeners.delete(listener);

    if (!visibilityListeners.size) {
      document.removeEventListener(
        "visibilitychange",
        notifyVisibility
      );
    }
  };
}

export function usePageVisible() {
  return useSyncExternalStore(
    subscribePageVisibility,
    getPageVisible,
    getServerSnapshot
  );
}

/* -------------------- REDUCED MOTION -------------------- */

const motionListeners = new Set();

let motionMedia = null;

function getMotionMedia() {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null;
  }

  motionMedia ??= window.matchMedia(MOTION_QUERY);

  return motionMedia;
}

function notifyMotion() {
  for (const listener of [...motionListeners]) {
    listener();
  }
}

function subscribeMotion(listener) {
  const media = getMotionMedia();

  if (!media) return noop;

  motionListeners.add(listener);

  if (motionListeners.size === 1) {
    media.addEventListener("change", notifyMotion);
  }

  return () => {
    motionListeners.delete(listener);

    if (!motionListeners.size) {
      media.removeEventListener("change", notifyMotion);
    }
  };
}

function getReducedMotion() {
  return getMotionMedia()?.matches ?? false;
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    getReducedMotion,
    getServerSnapshot
  );
}

/* -------------------- INTERSECTION OBSERVERS -------------------- */

const observers = new Map();

function getObserver(rootMargin) {
  const existing = observers.get(rootMargin);

  if (existing) return existing;

  const targets = new Map();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const callbacks = targets.get(entry.target);

        if (!callbacks) continue;

        for (const callback of [...callbacks]) {
          callback(entry.isIntersecting);
        }
      }
    },
    {
      rootMargin,
      threshold: 0,
    }
  );

  const record = {
    observer,
    targets,
  };

  observers.set(rootMargin, record);

  return record;
}

function observeElement(
  element,
  callback,
  {
    rootMargin = "0px",
    once = false,
  } = {}
) {
  if (!element) return noop;

  if (typeof IntersectionObserver === "undefined") {
    callback(true);
    return noop;
  }

  const record = getObserver(rootMargin);

  const { observer, targets } = record;

  let callbacks = targets.get(element);

  const newTarget = !callbacks;

  if (!callbacks) {
    callbacks = new Set();
    targets.set(element, callbacks);
  }

  let active = true;

  function unsubscribe() {
    if (!active) return;

    active = false;

    callbacks.delete(notify);

    if (!callbacks.size) {
      targets.delete(element);
      observer.unobserve(element);
    }

    if (!targets.size) {
      observer.disconnect();

      if (observers.get(rootMargin) === record) {
        observers.delete(rootMargin);
      }
    }
  }

  function notify(visible) {
    if (!active) return;

    if (once) {
      if (!visible) return;

      unsubscribe();
    }

    callback(visible);
  }

  callbacks.add(notify);

  if (newTarget) {
    observer.observe(element);
  }

  return unsubscribe;
}

/* -------------------- VIEWPORT HOOK -------------------- */

export function useViewport({
  rootMargin = "0px",
  once = false,
  enabled = true,
} = {}) {
  const containerRef = useRef(null);

  const [visible, setVisible] = useState(false);

  const shouldObserve =
    enabled && !(once && visible);

  useEffect(() => {
    if (!shouldObserve) return;

    const element = containerRef.current;

    if (!element) return;

    return observeElement(
      element,
      setVisible,
      {
        rootMargin,
        once,
      }
    );
  }, [
    shouldObserve,
    rootMargin,
    once,
  ]);

  return {
    containerRef,
    visible,
  };
}

export function useNearViewport(rootMargin = "75px") {
  return useViewport({
    rootMargin,
    once: true,
  });
}

/* -------------------- SHARED TIMER SCHEDULER -------------------- */

const scheduledTasks = new Map();

const MAX_TIMER_DELAY = 2_147_483_647;

let schedulerTimer = null;
let schedulerDeadline = Infinity;
let schedulerVisibilityCleanup = null;
let runningTasks = false;

function clearSchedulerTimer() {
  if (schedulerTimer !== null) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }

  schedulerDeadline = Infinity;
}

function syncScheduler() {
  if (runningTasks) return;

  if (!scheduledTasks.size) {
    clearSchedulerTimer();

    schedulerVisibilityCleanup?.();
    schedulerVisibilityCleanup = null;

    return;
  }

  if (!schedulerVisibilityCleanup) {
    schedulerVisibilityCleanup =
      subscribePageVisibility(syncScheduler);
  }

  if (!getPageVisible()) {
    clearSchedulerTimer();
    return;
  }

  let earliest = Infinity;

  for (const task of scheduledTasks.values()) {
    if (task.deadline < earliest) {
      earliest = task.deadline;
    }
  }

  if (
    schedulerTimer !== null &&
    schedulerDeadline === earliest
  ) {
    return;
  }

  clearSchedulerTimer();

  schedulerDeadline = earliest;

  schedulerTimer = setTimeout(
    runScheduledTasks,
    Math.min(
      MAX_TIMER_DELAY,
      Math.max(0, earliest - Date.now())
    )
  );
}

function runScheduledTasks() {
  schedulerTimer = null;
  schedulerDeadline = Infinity;

  if (!getPageVisible()) {
    syncScheduler();
    return;
  }

  const now = Date.now();

  runningTasks = true;

  try {
    for (const [id, task] of [...scheduledTasks]) {
      if (task.deadline > now) continue;

      // The task may have been cancelled or replaced
      // by an earlier callback.
      if (scheduledTasks.get(id) !== task) {
        continue;
      }

      scheduledTasks.delete(id);

      try {
        task.callback();
      } catch (error) {
        console.error(
          "Scheduled browser task failed:",
          error
        );
      }
    }
  } finally {
    runningTasks = false;
    syncScheduler();
  }
}

export function scheduleBrowserTask(
  callback,
  deadline
) {
  if (
    typeof window === "undefined" ||
    typeof callback !== "function" ||
    !Number.isFinite(deadline)
  ) {
    return noop;
  }

  const id = Symbol("browser-task");

  scheduledTasks.set(id, {
    callback,
    deadline,
  });

  syncScheduler();

  return () => {
    if (scheduledTasks.delete(id)) {
      syncScheduler();
    }
  };
}