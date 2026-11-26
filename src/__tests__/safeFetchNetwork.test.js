/**
 * @jest-environment node
 */

// src/__tests__/safeFetchNetwork.test.js

import {
    describe,
    test,
    expect,
    jest,
    beforeEach,
} from "@jest/globals";

/* -------------------- MODULE MOCKS -------------------- */

jest.doMock("server-only", () => ({}));
jest.doMock("node:dns/promises", () => ({ lookup: jest.fn() }));
jest.doMock("undici", () => ({ fetch: jest.fn(), Agent: jest.fn() }));

/* -------------------- MOCKED DEPENDENCIES -------------------- */

const { lookup } = require("node:dns/promises");

const {
    fetch: undiciFetch,
    Agent,
} = require("undici");

/* -------------------- APPLICATION MODULES -------------------- */

const {
    safeFetchHtml,
    safeFetchImage,
    safeFetchJson,
} = require("@/lib/server/safeFetch");

const {
    MAX_REDIRECTS,
} = require("@/constants/linkPreviews");

/* -------------------- CONSTANTS -------------------- */

const PUBLIC_URL = "https://example.com/";

const PUBLIC_ADDRESS = {
    address: "93.184.216.34",
    family: 4,
};

const PRIVATE_ADDRESS = {
    address: "192.168.1.1",
    family: 4,
};

const HTML = `
<html>
    <head>
        <title>Example website</title>
    </head>
    <body>Example content</body>
</html>
`;

/* -------------------- HELPERS -------------------- */

function htmlResponse(html = HTML) {
    return new Response(html, {
        status: 200,
        headers: {
            "content-type": "text/html",
        },
    });
}

function redirectResponse(location, status = 302) {
    const headers = {};

    if (location !== undefined) {
        headers.location = location;
    }

    return new Response(null, {
        status,
        headers,
    });
}

/* -------------------- SETUP -------------------- */

beforeEach(() => {
    jest.resetAllMocks();

    expect(jest.isMockFunction(lookup)).toBe(true);
    expect(jest.isMockFunction(undiciFetch)).toBe(true);
    expect(jest.isMockFunction(Agent)).toBe(true);

    lookup.mockResolvedValue([PUBLIC_ADDRESS]);

    Agent.mockImplementation(() => ({ destroy: jest.fn().mockResolvedValue(undefined) }));

    undiciFetch.mockImplementation(async () => htmlResponse());
});

/* -------------------- NORMAL REQUESTS -------------------- */

describe("Safe public website requests", () => {
    test("retrieves public HTML", async () => {
        const result = await safeFetchHtml(PUBLIC_URL);
        expect(result.html).toContain("<title>Example website</title>");
        expect(result.finalUrl).toBe(PUBLIC_URL);
        expect(undiciFetch).toHaveBeenCalledTimes(1);
    });

    test("requests manual redirect handling", async () => {
        await safeFetchHtml(PUBLIC_URL);

        expect(undiciFetch).toHaveBeenCalledWith(
            PUBLIC_URL,
            expect.objectContaining({
                method: "GET",
                redirect: "manual",
            })
        );
    });

    test("resolves all DNS addresses", async () => {
        await safeFetchHtml(PUBLIC_URL);

        expect(lookup).toHaveBeenCalledWith(
            "example.com",
            expect.objectContaining({
                all: true,
            })
        );
    });

    test("destroys the agent after success", async () => {
        await safeFetchHtml(PUBLIC_URL);

        const agent = Agent.mock.results[0].value;

        expect(agent.destroy).toHaveBeenCalledTimes(1);
    });
});

/* -------------------- DNS SECURITY -------------------- */

describe("DNS security", () => {
    test.each([
        ["127.0.0.1", 4],
        ["10.0.0.1", 4],
        ["172.16.0.1", 4],
        ["192.168.1.1", 4],
        ["169.254.169.254", 4],
        ["100.64.0.1", 4],
        ["::1", 6],
        ["fd00::1", 6],
        ["fe80::1", 6],
        ["::ffff:127.0.0.1", 6],
    ])(
        "blocks hostname resolving to %s",
        async (address, family) => {
            lookup.mockResolvedValue([
                { address, family },
            ]);

            await expect(safeFetchHtml(PUBLIC_URL)).rejects.toThrow();
            expect(undiciFetch).not.toHaveBeenCalled();
            expect(Agent).not.toHaveBeenCalled();
        }
    );

    test("rejects mixed public and private DNS results", async () => {
        lookup.mockResolvedValue([
            PUBLIC_ADDRESS,
            PRIVATE_ADDRESS,
        ]);

        await expect(safeFetchHtml(PUBLIC_URL)).rejects.toThrow();

        expect(undiciFetch).not.toHaveBeenCalled();
    });

    test("rejects private DNS result listed first", async () => {
        lookup.mockResolvedValue([
            PRIVATE_ADDRESS,
            PUBLIC_ADDRESS,
        ]);

        await expect(safeFetchHtml(PUBLIC_URL)).rejects.toThrow();
        expect(undiciFetch).not.toHaveBeenCalled();
    });

    test("rejects empty DNS results", async () => {
        lookup.mockResolvedValue([]);
        await expect(safeFetchHtml(PUBLIC_URL)).rejects.toThrow();
        expect(undiciFetch).not.toHaveBeenCalled();
    });

    test("rejects failed DNS resolution", async () => {
        lookup.mockRejectedValue(new Error("DNS lookup failed"));
        await expect(safeFetchHtml(PUBLIC_URL)).rejects.toThrow();
        expect(undiciFetch).not.toHaveBeenCalled();
    });
});

/* -------------------- IP PINNING -------------------- */

describe("DNS connection pinning", () => {
    test("uses the previously validated address", async () => {
        lookup
            .mockResolvedValueOnce([PUBLIC_ADDRESS])
            .mockResolvedValueOnce([PRIVATE_ADDRESS]);

        await safeFetchHtml(PUBLIC_URL);

        const options = Agent.mock.calls[0][0];
        const pinnedLookup = options.connect.lookup;
        const callback = jest.fn();

        pinnedLookup("example.com", { all: false }, callback);
        expect(callback).toHaveBeenCalledWith(null, PUBLIC_ADDRESS.address, PUBLIC_ADDRESS.family);

        // The connection lookup must not resolve
        // the hostname a second time.
        expect(lookup).toHaveBeenCalledTimes(1);
    });

    test("supports all-address lookup mode", async () => {
        await safeFetchHtml(PUBLIC_URL);
        const options = Agent.mock.calls[0][0];
        const callback = jest.fn();
        options.connect.lookup("example.com", { all: true }, callback);
        expect(callback).toHaveBeenCalledWith(null, [PUBLIC_ADDRESS]);
    });

    test("rejects unexpected connection hostnames", async () => {
        await safeFetchHtml(PUBLIC_URL);
        const options = Agent.mock.calls[0][0];
        const callback = jest.fn();
        options.connect.lookup("different.example.com", { all: false }, callback);

        expect(callback).toHaveBeenCalled();
        expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    });
});

/* -------------------- VALID REDIRECTS -------------------- */

describe("Valid redirects", () => {
    test.each([
        301,
        302,
        303,
        307,
        308,
    ])(
        "follows valid HTTP %i redirect",
        async (status) => {
            const destination = "https://www.example.org/";

            undiciFetch
                .mockResolvedValueOnce(redirectResponse(destination, status))
                .mockResolvedValueOnce(htmlResponse());

            const result = await safeFetchHtml(PUBLIC_URL);

            expect(result.finalUrl).toBe(destination);
            expect(lookup).toHaveBeenCalledTimes(2);
            expect(undiciFetch).toHaveBeenCalledTimes(2);
            expect(lookup).toHaveBeenNthCalledWith(2, "www.example.org", expect.objectContaining({ all: true }));
        }
    );

    test("supports relative redirects", async () => {
        undiciFetch
            .mockResolvedValueOnce(redirectResponse("/article"))
            .mockResolvedValueOnce(htmlResponse());

        const result = await safeFetchHtml(PUBLIC_URL);
        expect(result.finalUrl).toBe("https://example.com/article");
    });

    test("allows HTTP to HTTPS upgrades", async () => {
        undiciFetch
            .mockResolvedValueOnce(redirectResponse(PUBLIC_URL))
            .mockResolvedValueOnce(htmlResponse());

        const result = await safeFetchHtml("http://example.com/");
        expect(result.finalUrl).toBe(PUBLIC_URL);
    });
});

/* -------------------- MALICIOUS REDIRECTS -------------------- */

describe("Unsafe redirects", () => {
    test.each([
        "https://localhost/",
        "https://127.0.0.1/",
        "https://192.168.1.1/",
        "https://169.254.169.254/",
        "https://[::1]/",
        "https://[fd00::1]/",
        "https://server.internal/",
        "https://server.local/",
        "https://example.com:8443/",
        "https://user:password@example.com/",
        "http://example.com/",
        "file:///etc/passwd",
        "ftp://example.com/",
    ])(
        "blocks redirect to %s",
        async (destination) => {
            undiciFetch.mockResolvedValueOnce(redirectResponse(destination));

            await expect(safeFetchHtml(PUBLIC_URL)).rejects.toThrow();

            // The unsafe destination must never
            // receive an HTTP request.

            expect(undiciFetch).toHaveBeenCalledTimes(1);
        }
    );

    test("rejects redirect hostname resolving to private IP", async () => {
        lookup
            .mockResolvedValueOnce([PUBLIC_ADDRESS])
            .mockResolvedValueOnce([PRIVATE_ADDRESS]);

        undiciFetch.mockResolvedValueOnce(redirectResponse("https://redirect.example.org/"));

        await expect(safeFetchHtml(PUBLIC_URL)).rejects.toThrow();
        expect(lookup).toHaveBeenCalledTimes(2);
        expect(undiciFetch).toHaveBeenCalledTimes(1);
    });

    test("revalidates DNS for same-host redirects", async () => {
        lookup
            .mockResolvedValueOnce([PUBLIC_ADDRESS])
            .mockResolvedValueOnce([PRIVATE_ADDRESS]);

        undiciFetch.mockResolvedValueOnce(redirectResponse("/next"));
        await expect(safeFetchHtml(PUBLIC_URL)).rejects.toThrow();
        expect(lookup).toHaveBeenCalledTimes(2);
        expect(undiciFetch).toHaveBeenCalledTimes(1);
    });

    test("rejects missing redirect destination", async () => {
        undiciFetch.mockResolvedValueOnce(redirectResponse(undefined));
        await expect(safeFetchHtml(PUBLIC_URL)).rejects.toThrow("Invalid redirect");
        expect(undiciFetch).toHaveBeenCalledTimes(1);
    });

    test("rejects excessive redirects", async () => {
        undiciFetch.mockImplementation(async () => redirectResponse("/loop"));
        await expect(safeFetchHtml(PUBLIC_URL)).rejects.toThrow("Too many redirects");
        expect(undiciFetch).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
    });
});

/* -------------------- IMAGE REQUEST SECURITY -------------------- */

describe("Image request security", () => {
    test("rejects non-HTTPS image URLs", async () => {
        await expect(safeFetchImage("http://example.com/image.png")).rejects.toThrow();

        expect(undiciFetch).not.toHaveBeenCalled();
    });

    test("rejects image redirect to HTTP", async () => {
        undiciFetch.mockResolvedValueOnce(redirectResponse("http://example.com/image.png"));
        await expect(safeFetchImage("https://example.com/image.png")).rejects.toThrow();
        expect(undiciFetch).toHaveBeenCalledTimes(1);
    });

    test("rejects image redirect to private IP", async () => {
        undiciFetch.mockResolvedValueOnce(redirectResponse("https://192.168.1.1/image.png"));
        await expect(safeFetchImage("https://example.com/image.png")).rejects.toThrow();
        expect(undiciFetch).toHaveBeenCalledTimes(1);
    });

    test("rejects unsupported image content type", async () => {
        undiciFetch.mockResolvedValueOnce(
            new Response("<svg/>", {
                status: 200,
                headers: {
                    "content-type": "image/svg+xml",
                },
            })
        );

        await expect(safeFetchImage("https://example.com/image.svg")).rejects.toThrow();
    });
});

/* -------------------- RESOURCE CLEANUP -------------------- */

describe("Network resource cleanup", () => {
    test("destroys agent when request fails", async () => {
        undiciFetch.mockRejectedValue(new Error("Network failure"));
        await expect(safeFetchHtml(PUBLIC_URL)).rejects.toThrow();

        const agent = Agent.mock.results[0].value;
        expect(agent.destroy).toHaveBeenCalledTimes(1);
    });

    test("destroys agents after unsafe redirect", async () => {
        undiciFetch.mockResolvedValueOnce(redirectResponse("https://localhost/"));
        await expect(safeFetchHtml(PUBLIC_URL)).rejects.toThrow();

        const agent = Agent.mock.results[0].value;
        expect(agent.destroy).toHaveBeenCalledTimes(1);
    });

    test("destroys every agent after valid redirects", async () => {
        undiciFetch
            .mockResolvedValueOnce(redirectResponse("/article"))
            .mockResolvedValueOnce(htmlResponse());

        await safeFetchHtml(PUBLIC_URL);

        expect(Agent).toHaveBeenCalledTimes(2);

        for (const result of Agent.mock.results) {
            expect(result.value.destroy).toHaveBeenCalledTimes(1);
        }
    });
});

/* -------------------- JSON PROVIDER SECURITY -------------------- */

describe("JSON provider security", () => {
    const PROVIDER_URL =
        "https://www.youtube.com/oembed";

    const ALLOWED_HOSTNAMES = new Set([
        "www.youtube.com",
    ]);

    function jsonResponse(data) {
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                "content-type": "application/json",
            },
        });
    }

    test("retrieves JSON from an allowed provider", async () => {
        const data = {
            title: "Example video",
            type: "video",
        };

        undiciFetch.mockResolvedValueOnce(
            jsonResponse(data)
        );

        const result = await safeFetchJson(
            PROVIDER_URL,
            {
                allowedHostnames: ALLOWED_HOSTNAMES,
            }
        );

        expect(result.data).toEqual(data);

        expect(result.finalUrl).toBe(PROVIDER_URL);

        expect(undiciFetch).toHaveBeenCalledTimes(1);
    });

    test("rejects unexpected provider hostnames", async () => {
        await expect(
            safeFetchJson(
                "https://example.com/oembed",
                {
                    allowedHostnames: ALLOWED_HOSTNAMES,
                }
            )
        ).rejects.toThrow(
            "Unexpected provider hostname"
        );

        expect(lookup).not.toHaveBeenCalled();

        expect(undiciFetch).not.toHaveBeenCalled();
    });

    test("rejects redirects by default", async () => {
        undiciFetch.mockResolvedValueOnce(
            redirectResponse("/another-endpoint")
        );

        await expect(
            safeFetchJson(PROVIDER_URL, {
                allowedHostnames: ALLOWED_HOSTNAMES,
            })
        ).rejects.toThrow("Too many redirects");

        expect(undiciFetch).toHaveBeenCalledTimes(1);
    });

    test("allows an explicitly permitted redirect", async () => {
        undiciFetch
            .mockResolvedValueOnce(
                redirectResponse("/another-endpoint")
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    title: "Example video",
                })
            );

        const result = await safeFetchJson(
            PROVIDER_URL,
            {
                allowedHostnames: ALLOWED_HOSTNAMES,
                maxRedirects: 1,
            }
        );

        expect(result.finalUrl).toBe(
            "https://www.youtube.com/another-endpoint"
        );

        expect(undiciFetch).toHaveBeenCalledTimes(2);
    });

    test("rejects redirects outside the provider allowlist", async () => {
        undiciFetch.mockResolvedValueOnce(
            redirectResponse(
                "https://example.com/oembed"
            )
        );

        await expect(
            safeFetchJson(PROVIDER_URL, {
                allowedHostnames: ALLOWED_HOSTNAMES,
                maxRedirects: 1,
            })
        ).rejects.toThrow(
            "Unexpected provider hostname"
        );

        expect(undiciFetch).toHaveBeenCalledTimes(1);
    });

    test("enforces custom redirect limits", async () => {
        undiciFetch.mockImplementation(
            async () => redirectResponse("/loop")
        );

        await expect(
            safeFetchJson(PROVIDER_URL, {
                allowedHostnames: ALLOWED_HOSTNAMES,
                maxRedirects: 1,
            })
        ).rejects.toThrow("Too many redirects");

        expect(undiciFetch).toHaveBeenCalledTimes(2);
    });

    test("rejects malformed JSON", async () => {
        undiciFetch.mockResolvedValueOnce(
            new Response("{invalid json}", {
                status: 200,
                headers: {
                    "content-type": "application/json",
                },
            })
        );

        await expect(
            safeFetchJson(PROVIDER_URL)
        ).rejects.toThrow("Invalid JSON response");
    });

    test("rejects incorrect JSON content types", async () => {
        undiciFetch.mockResolvedValueOnce(
            htmlResponse()
        );

        await expect(
            safeFetchJson(PROVIDER_URL)
        ).rejects.toThrow("Unsupported content type");
    });

    test("rejects non-HTTPS provider URLs", async () => {
        await expect(
            safeFetchJson(
                "http://www.youtube.com/oembed"
            )
        ).rejects.toThrow("HTTPS required");

        expect(undiciFetch).not.toHaveBeenCalled();
    });
});