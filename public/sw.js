// public/sw.js

const DEFAULT_PATH = "/messages";
const CHAT_PATH_PATTERN = /^\/messages\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSafePath(value) {
  if (
    typeof value === "string" &&
    CHAT_PATH_PATTERN.test(value)
  ) {
    return value;
  }

  return DEFAULT_PATH;
}

function getText(value, fallback) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function parsePushData(event) {
  if (!event.data) return {};

  try {
    const data = event.data.json();

    return data && typeof data === "object"
      ? data
      : {};
  } catch {
    return {};
  }
}

self.addEventListener("push", (event) => {
  const data = parsePushData(event);

  const path = getSafePath(data.url);

  const title = getText(
    data.title,
    "New message"
  );

  const body = getText(
    data.body,
    "You have a new message"
  );

  const tag = getText(
    data.tag,
    "messenger"
  );

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.ico",
      tag,
      renotify: true,
      data: {
        url: path,
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const path = getSafePath(
    event.notification.data?.url
  );

  const targetUrl = new URL(
    path,
    self.location.origin
  );

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const sameOriginWindows = windows.filter(
        (client) =>
          new URL(client.url).origin ===
          self.location.origin
      );

      // Focus the correct conversation if already open.
      const matchingWindow = sameOriginWindows.find(
        (client) =>
          new URL(client.url).pathname === path
      );

      if (matchingWindow) {
        return matchingWindow.focus();
      }

      // Reuse an existing Messenger window.
      const existingWindow = sameOriginWindows[0];

      if (existingWindow) {
        try {
          const navigatedWindow =
            await existingWindow.navigate(
              targetUrl.href
            );

          if (navigatedWindow) {
            return navigatedWindow.focus();
          }
        } catch (error) {
          console.warn(
            "Unable to navigate existing window:",
            error
          );
        }
      }

      // Open Messenger if no usable window exists.
      return self.clients.openWindow(
        targetUrl.href
      );
    })()
  );
});
