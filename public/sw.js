// public/sw.js

const DEFAULT_PATH = "/messages";
const UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const UUID_PATTERN = new RegExp(`^${UUID_SOURCE}$`, "i");
const CHAT_PATH_PATTERN = new RegExp(`^/messages/(${UUID_SOURCE})$`, "i");

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 250;

/* -------------------- VALIDATION -------------------- */

function getSafePath(value) {
  return (
    typeof value === "string" &&
    value.length === DEFAULT_PATH.length + 37 &&
    CHAT_PATH_PATTERN.test(value)
  )
    ? value
    : DEFAULT_PATH;
}

function getMessageId(value) {
  return (
    typeof value === "string" &&
    value.length === 36 &&
    UUID_PATTERN.test(value)
  )
    ? value.toLowerCase()
    : null;
}

function getText(value, fallback, maxLength) {
  const text =
    typeof value === "string"
      ? value.trim()
      : "";

  return (text || fallback).slice(0, maxLength);
}

function getNotificationTag(path) {
  const match = CHAT_PATH_PATTERN.exec(path);

  return match
    ? `chat:${match[1].toLowerCase()}`
    : "messenger";
}

function parsePushData(event) {
  try {
    const data = event.data?.json();

    return (
      data &&
      typeof data === "object" &&
      !Array.isArray(data)
    )
      ? data
      : {};
  } catch {
    return {};
  }
}

/* -------------------- PUSH -------------------- */

async function handlePush(event) {
  const data = parsePushData(event);

  const path = getSafePath(data.url);
  const messageId = getMessageId(data.messageId);
  const tag = getNotificationTag(path);

  const title = getText(
    data.title,
    "New message",
    MAX_TITLE_LENGTH
  );

  const body = getText(
    data.body,
    "You have a new message",
    MAX_BODY_LENGTH
  );

  let duplicate = false;

  if (messageId) {
    try {
      const existing =
        await self.registration.getNotifications({
          tag,
        });

      duplicate = existing.some(
        (notification) =>
          notification.data?.messageId === messageId
      );
    } catch {
      // Continue displaying notifications if
      // the browser cannot inspect existing ones.
    }
  }

  await self.registration.showNotification(title, {
    body,

    icon: "/favicon.ico",

    tag,

    renotify: !duplicate,

    silent: duplicate,

    data: {
      url: path,
      messageId,
    },
  });
}

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

/* -------------------- WINDOW NAVIGATION -------------------- */

async function focusMessenger(path) {
  const origin = self.location.origin;

  const targetUrl = new URL(path, origin);

  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  let reusableWindow = null;

  for (const client of windows) {
    const url = new URL(client.url);

    if (url.origin !== origin) {
      continue;
    }

    if (url.pathname === path) {
      try {
        return await client.focus();
      } catch {
        continue;
      }
    }

    const isMessenger =
      url.pathname === DEFAULT_PATH ||
      url.pathname.startsWith("/messages/");

    if (isMessenger && !reusableWindow) {
      reusableWindow = client;
    }
  }

  if (reusableWindow) {
    try {
      const navigated =
        await reusableWindow.navigate(targetUrl.href);

      if (navigated) {
        return await navigated.focus();
      }
    } catch {
      // Open a new window if reuse fails.
    }
  }

  return self.clients.openWindow(targetUrl.href);
}

/* -------------------- NOTIFICATION CLICK -------------------- */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const path = getSafePath(
    event.notification.data?.url
  );

  event.waitUntil(focusMessenger(path));
});