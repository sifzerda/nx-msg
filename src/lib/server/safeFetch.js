// src/lib/server/safeFetch.js

import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import ipaddr from "ipaddr.js";

import {
    Agent,
    fetch as undiciFetch,
} from "undici";

import { normalizeUrl } from "@/utils/urlUtils";

import {
    MAX_REDIRECTS,
    FETCH_TIMEOUT,
    MAX_HTML_BYTES,
    ALLOWED_CONTENT_TYPES,
} from "@/constants/linkPreviews";

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

const REQUEST_HEADERS = {
    "User-Agent": "MessengerLinkPreview/1.0",
    Accept: "text/html,application/xhtml+xml",
    "Accept-Encoding": "identity",
};

/* -------------------- IP VALIDATION -------------------- */

export function isPublicIp(value) {
    try {
        let address = ipaddr.parse(value);

        if (
            address.kind() === "ipv6" &&
            address.isIPv4MappedAddress()
        ) {
            address = address.toIPv4Address();
        }

        if (address.range() !== "unicast") {
            return false;
        }

        // Only allow globally routed IPv6 address space.
        if (address.kind() === "ipv6") {
            if (
                !address.match(
                    ipaddr.parse("2000::"),
                    3
                )
            ) {
                return false;
            }
        }

        return true;
    } catch {
        return false;
    }
}

/* -------------------- URL VALIDATION -------------------- */

function validateTarget(value) {
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
        hostname === "localhost" ||
        BLOCKED_HOST_SUFFIXES.some((suffix) =>
            hostname.endsWith(suffix)
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
        if (signal.aborted) {
            reject(signal.reason);
            return;
        }

        function handleAbort() {
            reject(signal.reason);
        }

        signal.addEventListener(
            "abort",
            handleAbort,
            { once: true }
        );

        Promise.resolve(promise)
            .then(resolve, reject)
            .finally(() => {
                signal.removeEventListener(
                    "abort",
                    handleAbort
                );
            });
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

function validateResponse(response) {
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

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        throw new Error("Unsupported content type");
    }
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

/* -------------------- SAFE FETCH -------------------- */

export async function safeFetchHtml(value) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort(new Error("Website request timed out"));
    }, FETCH_TIMEOUT);

    let currentUrl = value;

    try {
        for (
            let redirectCount = 0;
            redirectCount <= MAX_REDIRECTS;
            redirectCount += 1
        ) {
            const { url, hostname } =
                validateTarget(currentUrl);

            const address = await resolvePublicAddress(
                hostname,
                controller.signal
            );

            const agent = createPinnedAgent(
                hostname,
                address
            );

            let response;

            try {
                response = await undiciFetch(url.href, {
                    method: "GET",
                    headers: REQUEST_HEADERS,
                    redirect: "manual",
                    dispatcher: agent,
                    signal: controller.signal,
                });

                if (
                    REDIRECT_STATUSES.has(response.status)
                ) {
                    if (redirectCount >= MAX_REDIRECTS) {
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

                    // Prevent HTTPS-to-HTTP downgrades.
                    if (
                        url.protocol === "https:" &&
                        destination.protocol !== "https:"
                    ) {
                        throw new Error(
                            "Insecure redirect blocked"
                        );
                    }

                    currentUrl = destination.href;

                    // The next iteration validates the
                    // destination and resolves its DNS again.
                    continue;
                }

                validateResponse(response);

                const html = await readLimitedBody(
                    response
                );

                return {
                    html,
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