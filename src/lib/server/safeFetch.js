// src/lib/server/safeFetch.js

import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, fetch as undiciFetch } from "undici";
import { normalizeUrl } from "@/utils/urlUtils";
import {
    MAX_REDIRECTS,
    FETCH_TIMEOUT,
    MAX_HTML_BYTES,
    MAX_IMAGE_BYTES,
    MAX_JSON_BYTES,
    ALLOWED_CONTENT_TYPES,
    ALLOWED_IMAGE_CONTENT_TYPES,
    ALLOWED_JSON_CONTENT_TYPES,
} from "@/constants/linkPreviews";
import { isPreviewAllowed } from "@/utils/previewUrlPolicy";

const REDIRECT_STATUSES = new Set([
    301,
    302,
    303,
    307,
    308,
]);

const BLOCKED_HOST_SUFFIXES = [
    ".localhost",
    ".local",
    ".internal",
    ".lan",
    ".home",
    ".test",
    ".invalid",
    ".onion",
    ".arpa",
];

const REQUEST_HEADERS = Object.freeze({
    "User-Agent": "MessengerLinkPreview/1.0",
    "Accept-Encoding": "identity",
});
/* -------------------- RESTRICTED IP RANGES -------------------- */

const BLOCKED_IPV4_RANGES = [
    "0.0.0.0/8",
    "10.0.0.0/8",
    "100.64.0.0/10",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "172.16.0.0/12",
    "192.0.0.0/24",
    "192.0.2.0/24",
    "192.88.99.0/24",
    "192.168.0.0/16",
    "198.18.0.0/15",
    "198.51.100.0/24",
    "203.0.113.0/24",
    "224.0.0.0/4",
    "240.0.0.0/4",
].map((range) => ipaddr.parseCIDR(range));

const BLOCKED_IPV6_RANGES = [
    "2001::/23",
    "2001:db8::/32",
    "2002::/16",
    "3fff::/20",
].map((range) => ipaddr.parseCIDR(range));

const GLOBAL_IPV6_RANGE = ipaddr.parseCIDR("2000::/3");

/* -------------------- IP VALIDATION -------------------- */

export function isPublicIp(value) {
    if (
        typeof value !== "string" ||
        !isIP(value) ||
        value.includes("%")
    ) {
        return false;
    }

    try {
        let address = ipaddr.parse(value);

        // Normalise IPv4-mapped IPv6 addresses.
        if (
            address.kind() === "ipv6" && address.isIPv4MappedAddress()
        ) {
            address = address.toIPv4Address();
        }

        // Reject special-purpose addresses.
        if (address.range() !== "unicast") {
            return false;
        }

        if (address.kind() === "ipv4") {
            return !BLOCKED_IPV4_RANGES.some(([network, prefix]) => address.match(network, prefix));
        }

        if (address.kind() === "ipv6") {
            const [network, prefix] = GLOBAL_IPV6_RANGE;

            if (!address.match(network, prefix)) {
                return false;
            }

            return !BLOCKED_IPV6_RANGES.some(([blockedNetwork, blockedPrefix]) => address.match(blockedNetwork, blockedPrefix));
        }

        return false;
    } catch {
        return false;
    }
}

/* -------------------- URL VALIDATION -------------------- */

export function validateTarget(value) {
    const normalized = normalizeUrl(value);

    if (!normalized) {
        throw new Error("Invalid preview URL");
    }

    const url = new URL(normalized);

    const hostname = url.hostname
        .toLowerCase()
        .replace(/^\[|\]$/g, "")
        .replace(/\.$/, "");

    if (
        hostname === "localhost" || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)
        )
    ) {
        throw new Error("Blocked hostname");
    }

    // Only allow standard HTTP and HTTPS ports.
    if (url.port) {
        throw new Error("Unsupported port");
    }

    // Public website previews do not need IP literals.
    if (isIP(hostname)) {
        throw new Error("IP address URLs are not supported");
    }

    if (!hostname.includes(".")) {
        throw new Error("Invalid public hostname");
    }

    return {
        url,
        hostname,
    };
}

/* -------------------- ABORT HANDLING -------------------- */

function withAbort(promise, signal) {
    return new Promise((resolve, reject) => {
        function cleanup() {
            signal.removeEventListener(
                "abort",
                handleAbort
            );
        }

        function handleAbort() {
            cleanup();
            reject(signal.reason);
        }

        Promise.resolve(promise).then(
            (value) => {
                cleanup();
                resolve(value);
            },
            (error) => {
                cleanup();
                reject(error);
            }
        );

        if (signal.aborted) {
            handleAbort();
            return;
        }

        signal.addEventListener(
            "abort",
            handleAbort,
            { once: true }
        );
    });
}

/* -------------------- DNS RESOLUTION -------------------- */

async function resolvePublicAddress(
    hostname,
    signal
) {
    const addresses = await withAbort(
        lookup(hostname, {
            all: true,
            verbatim: true,
        }),
        signal
    );

    if (!addresses.length) {
        throw new Error("Hostname could not be resolved");
    }

    // Reject the entire hostname if any returned
    // address belongs to a restricted network.
    for (const entry of addresses) {
        if (!isPublicIp(entry.address)) {
            throw new Error("Blocked network address");
        }
    }

    // Prefer IPv4 for deployment compatibility.
    return (
        addresses.find((entry) => entry.family === 4) ||
        addresses[0]
    );
}

/* -------------------- PINNED CONNECTION -------------------- */

function createPinnedAgent(hostname, address) {
    return new Agent({
        connections: 1,
        pipelining: 0,

        connect: {
            timeout: FETCH_TIMEOUT,

            lookup(requestedHostname, options, callback) {
                const requested = requestedHostname
                    .toLowerCase()
                    .replace(/\.$/, "");

                if (requested !== hostname) {
                    callback(
                        new Error("Unexpected DNS hostname")
                    );

                    return;
                }

                if (options?.all) {
                    callback(null, [
                        {
                            address: address.address,
                            family: address.family,
                        },
                    ]);

                    return;
                }

                callback(
                    null,
                    address.address,
                    address.family
                );
            },
        },
    });
}

/* -------------------- RESPONSE VALIDATION -------------------- */

function validateResponse(response, allowedContentTypes) {
    if (!response.ok) {
        throw new Error(
            `Website returned HTTP ${response.status}`
        );
    }

    const contentType = (
        response.headers.get("content-type") || ""
    )
        .split(";")[0]
        .trim()
        .toLowerCase();

    if (!allowedContentTypes.has(contentType)) {
        throw new Error("Unsupported content type");
    }

    return contentType;
}

/* -------------------- LIMITED BODY READER -------------------- */

async function readLimitedBody(response) {
    if (!response.body) {
        throw new Error(
            "Website returned an empty response"
        );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    const chunks = [];

    let totalBytes = 0;
    let searchTail = "";

    const HEAD_END_PATTERN = /<\/head\s*>/i;

    try {
        while (totalBytes < MAX_HTML_BYTES) {
            const { done, value } = await reader.read();

            if (done) break;

            const remainingBytes =
                MAX_HTML_BYTES - totalBytes;

            const limitedValue =
                value.byteLength > remainingBytes
                    ? value.subarray(0, remainingBytes)
                    : value;

            totalBytes += limitedValue.byteLength;

            const chunk = decoder.decode(
                limitedValue,
                { stream: true }
            );

            // Retain a small portion of the previous
            // chunk to detect closing tags split
            // across multiple network chunks.

            const searchable = searchTail + chunk;

            const headEnd =
                HEAD_END_PATTERN.exec(searchable);

            if (headEnd) {
                const endPosition =
                    headEnd.index +
                    headEnd[0].length -
                    searchTail.length;

                chunks.push(
                    chunk.slice(0, Math.max(0, endPosition))
                );

                break;
            }

            chunks.push(chunk);

            searchTail = searchable.slice(-64);

            if (totalBytes >= MAX_HTML_BYTES) {
                break;
            }
        }

        chunks.push(decoder.decode());

        const html = chunks.join("");

        if (!html.trim()) {
            throw new Error("Website returned an empty HTML document");
        }

        return html;
    } finally {
        try {
            await reader.cancel();
        } catch {
            // Stream may already be closed.
        }

        reader.releaseLock();
    }
}

/* -------------------- LIMITED BINARY READER -------------------- */

async function readLimitedBuffer(response, maxBytes) {
    if (!response.body) {
        throw new Error("Empty response");
    }

    const contentLength = Number(
        response.headers.get("content-length")
    );

    if (
        Number.isFinite(contentLength) &&
        contentLength > maxBytes
    ) {
        throw new Error("Response exceeds size limit");
    }

    const reader = response.body.getReader();

    const chunks = [];

    let totalBytes = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            totalBytes += value.byteLength;

            if (totalBytes > maxBytes) {
                throw new Error("Response exceeds size limit");
            }

            chunks.push(value);
        }

        if (!totalBytes) {
            throw new Error("Empty response");
        }

        return Buffer.concat(chunks, totalBytes);
    } finally {
        try {
            await reader.cancel();
        } catch {
            // Stream may already be closed.
        }

        reader.releaseLock();
    }
}

/* -------------------- LIMITED JSON READER -------------------- */

async function readLimitedJson(response) {
    const buffer = await readLimitedBuffer(response, MAX_JSON_BYTES);
    const decoder = new TextDecoder("utf-8", { fatal: true });

    try {
        return JSON.parse(decoder.decode(buffer));
    } catch {
        throw new Error("Invalid JSON response");
    }
}
/* -------------------- SHARED SAFE FETCH -------------------- */

async function safeFetchResource(
  value,
  {
    accept,
    allowedContentTypes,
    readBody,
    httpsOnly = false,
    allowedHostnames = null,
    maxRedirects = MAX_REDIRECTS,
    timeoutMs = FETCH_TIMEOUT,
  }
) {
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0
  ) {
    throw new Error("Invalid request timeout");
  }

  if (
    !Number.isInteger(maxRedirects) ||
    maxRedirects < 0 ||
    maxRedirects > MAX_REDIRECTS
  ) {
    throw new Error("Invalid redirect limit");
  }

  const controller = new AbortController();
  const { signal } = controller;

  const timeout = setTimeout(() => {
    controller.abort(
      new Error("Website request timed out")
    );
  }, Math.min(timeoutMs, FETCH_TIMEOUT));

  let currentUrl = value;

  try {
    for (
      let redirectCount = 0;
      redirectCount <= maxRedirects;
      redirectCount++
    ) {
      signal.throwIfAborted();

      /* Validate the original URL before normalisation. */

      if (!isPreviewAllowed(currentUrl)) {
        throw new Error(
          "Sensitive preview URL blocked"
        );
      }

      const { url, hostname } =
        validateTarget(currentUrl);

      if (
        allowedHostnames &&
        !allowedHostnames.has(hostname)
      ) {
        throw new Error(
          "Unexpected provider hostname"
        );
      }

      if (
        httpsOnly &&
        url.protocol !== "https:"
      ) {
        throw new Error("HTTPS required");
      }

      /* Resolve and validate the destination address. */

      const address = await resolvePublicAddress(
        hostname,
        signal
      );

      signal.throwIfAborted();

      const agent = createPinnedAgent(
        hostname,
        address
      );

      let response;

      try {
        response = await undiciFetch(url.href, {
          method: "GET",

          headers: {
            ...REQUEST_HEADERS,
            Accept: accept,
          },

          redirect: "manual",
          dispatcher: agent,
          signal,
        });

        /* Handle redirects manually. */

        if (
          REDIRECT_STATUSES.has(response.status)
        ) {
          if (redirectCount >= maxRedirects) {
            throw new Error("Too many redirects");
          }

          const location =
            response.headers.get("location");

          if (!location) {
            throw new Error("Invalid redirect");
          }

          const destination = new URL(
            location,
            url
          );

          if (
            (
              httpsOnly ||
              url.protocol === "https:"
            ) &&
            destination.protocol !== "https:"
          ) {
            throw new Error(
              "Insecure redirect blocked"
            );
          }

          currentUrl = destination.href;

          continue;
        }

        /* Validate and read the response. */

        const contentType = validateResponse(
          response,
          allowedContentTypes
        );

        const body = await readBody(response);

        signal.throwIfAborted();

        return {
          body,
          contentType,
          finalUrl: url.href,
        };
      } finally {
        if (
          response?.body &&
          !response.body.locked
        ) {
          try {
            await response.body.cancel();
          } catch {
            // Body may already be consumed.
          }
        }

        await agent.destroy();
      }
    }

    throw new Error("Too many redirects");
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------- HTML FETCH -------------------- */

export async function safeFetchHtml(value, { timeoutMs = FETCH_TIMEOUT } = {}) {
    const result = await safeFetchResource(value, {
        accept: "text/html,application/xhtml+xml",
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        readBody: readLimitedBody,
        timeoutMs,
    });

    return {
        html: result.body,
        finalUrl: result.finalUrl,
    };
}
/* -------------------- IMAGE FETCH -------------------- */

export async function safeFetchImage(value) {
    const result = await safeFetchResource(value, {
        accept: "image/webp,image/png,image/jpeg,image/gif",

        allowedContentTypes:
            ALLOWED_IMAGE_CONTENT_TYPES,

        readBody: (response) =>
            readLimitedBuffer(
                response,
                MAX_IMAGE_BYTES
            ),

        httpsOnly: true,
    });

    return {
        buffer: result.body,
        contentType: result.contentType,
        finalUrl: result.finalUrl,
    };
}

/* -------------------- JSON FETCH -------------------- */

export async function safeFetchJson(
  value,
  {
    allowedHostnames = null,
    maxRedirects = 0,
    timeoutMs = FETCH_TIMEOUT,
  } = {}
) {
  const result = await safeFetchResource(value, {
    accept: "application/json",

    allowedContentTypes:
      ALLOWED_JSON_CONTENT_TYPES,

    readBody: readLimitedJson,

    httpsOnly: true,
    allowedHostnames,
    maxRedirects,
    timeoutMs,
  });

  return {
    data: result.body,
    finalUrl: result.finalUrl,
  };
}