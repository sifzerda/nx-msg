// src/__tests__/webPush.test.js

/** @jest-environment node */

import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

/* -------------------- MOCKS -------------------- */

jest.mock("server-only", () => ({}));

jest.mock("web-push", () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

let webpush;
let sendWebPush;
let isValidPushEndpoint;

/* -------------------- TEST DATA -------------------- */

const VAPID_ENV = {
  VAPID_SUBJECT: "mailto:test@example.com",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-public",
  VAPID_PRIVATE_KEY: "test-private",
};

const originalEnv = Object.fromEntries(
  Object.keys(VAPID_ENV).map((key) => [
    key,
    process.env[key],
  ])
);

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test-device",
  p256dh: "public-encryption-key",
  auth_key: "authentication-key",
};

const payload = {
  title: "Alex sent you a message",
  body: "You have a new message",
  url: "/messages/chat-123",
};

const deliveryOptions = {
  TTL: 3600,
  timeout: 10000,
};

/* -------------------- SETUP -------------------- */

beforeEach(() => {
  jest.resetModules();

  Object.assign(process.env, VAPID_ENV);

  webpush = require("web-push");

  jest.resetAllMocks();

  webpush.sendNotification.mockResolvedValue({
    statusCode: 201,
  });

  ({
    sendWebPush,
    isValidPushEndpoint,
  } = require("@/lib/webPush"));
});

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

/* -------------------- VAPID CONFIGURATION -------------------- */

describe("Web Push - VAPID configuration", () => {
  test("configures VAPID credentials", async () => {
    await sendWebPush(subscription, payload);

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      VAPID_ENV.VAPID_SUBJECT,
      VAPID_ENV.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      VAPID_ENV.VAPID_PRIVATE_KEY
    );
  });

  test("configures VAPID only once for multiple notifications", async () => {
    await sendWebPush(subscription, payload);
    await sendWebPush(subscription, payload);
    await sendWebPush(subscription, payload);

    expect(webpush.setVapidDetails)
      .toHaveBeenCalledTimes(1);

    expect(webpush.sendNotification)
      .toHaveBeenCalledTimes(3);
  });

  test.each(Object.keys(VAPID_ENV))(
    "rejects missing %s",
    async (key) => {
      delete process.env[key];

      await expect(
        sendWebPush(subscription, payload)
      ).rejects.toThrow(
        "Missing Web Push environment variables"
      );

      expect(webpush.setVapidDetails)
        .not.toHaveBeenCalled();

      expect(webpush.sendNotification)
        .not.toHaveBeenCalled();
    }
  );
});

/* -------------------- NOTIFICATION DELIVERY -------------------- */

describe("Web Push - notification delivery", () => {
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
      deliveryOptions
    );
  });

  test("returns the delivery response", async () => {
    const response = await sendWebPush(
      subscription,
      payload
    );

    expect(response).toEqual({
      statusCode: 201,
    });
  });

  test("accepts an already serialised payload", async () => {
    const serialised = JSON.stringify(payload);

    await sendWebPush(subscription, serialised);

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: subscription.endpoint,
      }),
      serialised,
      deliveryOptions
    );
  });

  test("propagates push delivery errors", async () => {
    webpush.sendNotification.mockRejectedValueOnce(
      new Error("Push service unavailable")
    );

    await expect(
      sendWebPush(subscription, payload)
    ).rejects.toThrow("Push service unavailable");
  });

  test.each([404, 410])(
    "preserves expired subscription error status %i",
    async (statusCode) => {
      const error = Object.assign(
        new Error("Subscription expired"),
        { statusCode }
      );

      webpush.sendNotification.mockRejectedValueOnce(
        error
      );

      await expect(
        sendWebPush(subscription, payload)
      ).rejects.toBe(error);
    }
  );
});

/* -------------------- ENDPOINT SECURITY -------------------- */

describe("Web Push - endpoint validation", () => {
  test.each([
    "https://fcm.googleapis.com/fcm/send/test",
    "https://updates.push.services.mozilla.com/test",
    "https://web.push.apple.com/test",
    "https://example.notify.windows.com/test",
    "https://example.push.apple.com/test",
  ])("accepts trusted endpoint %s", (endpoint) => {
    expect(isValidPushEndpoint(endpoint)).toBe(true);
  });

  test.each([
    "",
    null,
    undefined,
    "not-a-url",
    "http://fcm.googleapis.com/test",
    "https://example.com/test",
    "https://localhost/test",
    "https://127.0.0.1/test",
    "https://192.168.1.1/test",
    "https://169.254.169.254/test",
    "https://[::1]/test",
    "https://fcm.googleapis.com.example.com/test",
    "https://fakefcm.googleapis.com/test",
    "https://example.push.apple.com.evil.com/test",
    "https://fcm.googleapis.com:8080/test",
    "https://user:password@fcm.googleapis.com/test",
    "https://fcm.googleapis.com/test#fragment",
    "ftp://fcm.googleapis.com/test",
    "javascript:alert(1)",
  ])("rejects unsupported endpoint %p", (endpoint) => {
    expect(isValidPushEndpoint(endpoint)).toBe(false);
  });

  test("rejects excessively long endpoints", () => {
    const endpoint =
      "https://fcm.googleapis.com/" + "a".repeat(5000);

    expect(isValidPushEndpoint(endpoint)).toBe(false);
  });

  test("does not send notifications to unsupported endpoints", async () => {
    await expect(
      sendWebPush(
        {
          ...subscription,
          endpoint: "https://example.com/test",
        },
        payload
      )
    ).rejects.toThrow("Unsupported push endpoint");

    expect(webpush.setVapidDetails)
      .not.toHaveBeenCalled();

    expect(webpush.sendNotification)
      .not.toHaveBeenCalled();
  });

  test.each([null, undefined, {}])(
    "rejects invalid subscription %p",
    async (invalidSubscription) => {
      await expect(
        sendWebPush(invalidSubscription, payload)
      ).rejects.toThrow("Unsupported push endpoint");

      expect(webpush.sendNotification)
        .not.toHaveBeenCalled();
    }
  );
});