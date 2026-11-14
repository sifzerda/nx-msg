// src/lib/__tests__/webPush.test.js

/** @jest-environment node */

// tests message notification

jest.mock("server-only", () => ({}));

jest.mock("web-push", () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

const webpush = require("web-push");
const { sendWebPush } = require("@/lib/webPush");

describe("Web Push", () => {
  const subscription = {
    endpoint: "https://push.example.com/test",
    p256dh: "public-encryption-key",
    auth_key: "authentication-key",
  };

  const payload = {
    title: "Alex sent you a message",
    body: "You have a new message",
    url: "/messages/chat-123",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public";
    process.env.VAPID_PRIVATE_KEY = "test-private";

    webpush.sendNotification.mockResolvedValue({
      statusCode: 201,
    });
  });

  afterAll(() => {
    delete process.env.VAPID_SUBJECT;
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  test("configures VAPID credentials", async () => {
    await sendWebPush(subscription, payload);

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      "mailto:test@example.com",
      "test-public",
      "test-private"
    );
  });

  test("sends the correct notification", async () => {
    await sendWebPush(subscription, payload);

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth_key,
        },
      },
      JSON.stringify(payload),
      { TTL: 3600 }
    );
  });

  test("rejects missing VAPID configuration", async () => {
    delete process.env.VAPID_SUBJECT;

    await expect(
      sendWebPush(subscription, payload)
    ).rejects.toThrow("Missing Web Push environment variables");

    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  test("propagates push delivery errors", async () => {
    webpush.sendNotification.mockRejectedValue(
      new Error("Push service unavailable")
    );

    await expect(
      sendWebPush(subscription, payload)
    ).rejects.toThrow("Push service unavailable");
  });
});
