/**
 * @jest-environment node
 */

// src/__tests__/safeFetch.test.js

import {
    describe,
    test,
    expect,
    jest,
} from "@jest/globals";

jest.mock("server-only", () => ({}));

import {
    isPublicIp,
    validateTarget,
} from "@/lib/server/safeFetch";

/* -------------------- PUBLIC IPV4 -------------------- */

describe("Public IPv4 addresses", () => {
    test.each([
        "8.8.8.8",
        "8.8.4.4",
        "1.1.1.1",
        "1.0.0.1",
        "9.9.9.9",
        "208.67.222.222",
        "93.184.216.34",
    ])("allows public address %s", (address) => {
        expect(isPublicIp(address)).toBe(true);
    });
});

/* -------------------- RESTRICTED IPV4 -------------------- */

describe("Restricted IPv4 addresses", () => {
    test.each([
        // Unspecified
        "0.0.0.0",
        "0.1.2.3",

        // Loopback
        "127.0.0.1",
        "127.0.0.2",
        "127.255.255.255",

        // Private networks
        "10.0.0.1",
        "10.255.255.255",
        "172.16.0.1",
        "172.31.255.255",
        "192.168.0.1",
        "192.168.255.255",

        // Carrier-grade NAT
        "100.64.0.1",
        "100.127.255.255",

        // Link-local
        "169.254.0.1",
        "169.254.169.254",

        // Special-purpose
        "192.0.0.1",
        "192.88.99.1",

        // Documentation
        "192.0.2.1",
        "198.51.100.1",
        "203.0.113.1",

        // Benchmarking
        "198.18.0.1",
        "198.19.255.255",

        // Multicast
        "224.0.0.1",
        "239.255.255.255",

        // Reserved
        "240.0.0.1",
        "255.255.255.255",
    ])("blocks restricted address %s", (address) => {
        expect(isPublicIp(address)).toBe(false);
    });
});

/* -------------------- PUBLIC IPV6 -------------------- */

describe("Public IPv6 addresses", () => {
    test.each([
        "2606:4700:4700::1111",
        "2606:4700:4700::1001",
        "2001:4860:4860::8888",
        "2001:4860:4860::8844",
    ])("allows public address %s", (address) => {
        expect(isPublicIp(address)).toBe(true);
    });
});

/* -------------------- RESTRICTED IPV6 -------------------- */

describe("Restricted IPv6 addresses", () => {
    test.each([
        // Unspecified and loopback
        "::",
        "::1",

        // Unique local
        "fc00::1",
        "fd00::1",

        // Link-local
        "fe80::1",
        "fe80::1%eth0",

        // Multicast
        "ff02::1",

        // Documentation
        "2001:db8::1",
        "3fff::1",

        // Transition and translation ranges
        "2002::1",
        "2001::1",
        "64:ff9b::1",
        "64:ff9b:1::1",

        // IPv4-mapped private addresses
        "::ffff:127.0.0.1",
        "::ffff:10.0.0.1",
        "::ffff:192.168.1.1",
        "::ffff:172.16.0.1",
        "::ffff:169.254.169.254",

        // Hexadecimal mapped addresses
        "::ffff:7f00:1",
        "::ffff:c0a8:101",
    ])("blocks restricted address %s", (address) => {
        expect(isPublicIp(address)).toBe(false);
    });
});

/* -------------------- MAPPED PUBLIC ADDRESSES -------------------- */

describe("IPv4-mapped public addresses", () => {
    test.each([
        "::ffff:8.8.8.8",
        "::ffff:1.1.1.1",
    ])("allows public mapped address %s", (address) => {
        expect(isPublicIp(address)).toBe(true);
    });
});

/* -------------------- INVALID IP INPUT -------------------- */

describe("Invalid IP addresses", () => {
    test.each([
        null,
        undefined,
        "",
        "localhost",
        "example.com",
        "invalid",
        "999.999.999.999",
        "127.1",
        "0x7f000001",
        2130706433,
    ])("rejects invalid input %s", (address) => {
        expect(isPublicIp(address)).toBe(false);
    });
});

/* -------------------- VALID URL TARGETS -------------------- */

describe("Valid preview targets", () => {
    test.each([
        "https://example.com/",
        "https://github.com/",
        "https://www.wikipedia.org/",
        "https://www.youtube.com/",
        "http://example.com/",
        "https://example.com:443/",
        "http://example.com:80/",
    ])("accepts valid target %s", (value) => {
        const result = validateTarget(value);

        expect(result.url).toBeInstanceOf(URL);

        expect(result.hostname).toBeTruthy();
    });
});

/* -------------------- BLOCKED URL TARGETS -------------------- */

describe("Blocked preview targets", () => {
    test.each([
        // Local hostnames
        "http://localhost/",
        "http://localhost./",
        "http://example.localhost/",
        "http://server.local/",
        "http://server.internal/",
        "http://server.lan/",
        "http://server.home/",
        "http://server.test/",
        "http://server.invalid/",
        "http://server.onion/",
        "http://server.arpa/",

        // Single-label hostnames
        "http://intranet/",
        "http://server/",

        // Direct IPv4 addresses
        "http://127.0.0.1/",
        "http://192.168.1.1/",
        "http://10.0.0.1/",
        "http://169.254.169.254/",
        "http://8.8.8.8/",

        // Alternative IPv4 representations
        "http://127.1/",
        "http://2130706433/",
        "http://0x7f000001/",
        "http://0177.0.0.1/",

        // Direct IPv6 addresses
        "http://[::1]/",
        "http://[::ffff:127.0.0.1]/",
        "http://[fd00::1]/",

        // Nonstandard ports
        "https://example.com:8080/",
        "https://example.com:8443/",
        "http://example.com:3000/",
        "http://example.com:22/",

        // Unsupported protocols
        "file:///etc/passwd",
        "ftp://example.com/",
        "javascript:alert(1)",
        "data:text/html,hello",

        // Embedded credentials
        "https://user:password@example.com/",
        "https://user@example.com/",

        // Invalid input
        "",
        null,
        undefined,
        "not a URL",
    ])("rejects unsafe target %s", (value) => {
        expect(() =>
            validateTarget(value)
        ).toThrow();
    });
});