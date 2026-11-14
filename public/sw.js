// public/sw.js

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const path = typeof data.url === "string" && /^\/messages\/[0-9a-f-]{36}$/i.test(data.url) ? data.url : "/messages";

  event.waitUntil(
    self.registration.showNotification(
      data.title || "New message",
      {
        body: data.body || "You have a new message",
        icon: "/favicon.ico",
        tag: data.tag || "messenger",
        data: { url: path },
      }
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = new URL(event.notification.data?.url || "/messages", self.location.origin);

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windows) {
        if (client.url.startsWith(self.location.origin)) {
          await client.navigate(url.href);
          return client.focus();
        }
      }

      return clients.openWindow(url.href);
    })()
  );
});

