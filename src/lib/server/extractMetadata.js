// src/lib/server/extractMetadata.js

import "server-only";

import { load } from "cheerio";
import { safeFetchHtml, safeFetchJson } from "./safeFetch";
import { normalizeUrl, getUrlHostname } from "@/utils/urlUtils";
import { isPreviewAllowed } from "@/utils/previewUrlPolicy";
import { getYouTubeVideoId, getCanonicalYouTubeVideoUrl } from "@/utils/youtubeUtils";

import {
    MAX_TITLE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_SITE_NAME_LENGTH,
    MAX_JSON_LD_SCRIPTS,
    MAX_JSON_LD_LENGTH,
    MAX_JSON_LD_NODES,
    MAX_JSON_LD_DEPTH,
    MAX_IMAGE_CANDIDATES,
    METADATA_FETCH_TIMEOUT,
    YOUTUBE_FETCH_TIMEOUT,
    YOUTUBE_OEMBED_ENDPOINT,
    PREVIEW_QUALITY,
} from "@/constants/linkPreviews";

/* -------------------- METADATA SETTINGS -------------------- */

const META_KEYS = {
    title: [
        "og:title",
        "twitter:title",
        "title",
    ],

    description: [
        "og:description",
        "twitter:description",
        "description",
    ],

    siteName: [
        "og:site_name",
        "application-name",
    ],

    image: [
        "og:image:secure_url",
        "og:image",
        "og:image:url",
        "twitter:image",
        "twitter:image:src",
        "thumbnail",
        "thumbnailurl",
    ],

    fallbackTitle: [
        "headline",
        "name",
    ],
};

const SUPPORTED_META_KEYS = new Set(Object.values(META_KEYS).flat());

const HIGH_PRIORITY_TYPES = new Set([
    "VideoObject",
    "MusicVideoObject",
    "Article",
    "NewsArticle",
    "BlogPosting",
    "Product",
    "MusicAlbum",
    "MusicRecording",
    "Movie",
]);

const MEDIUM_PRIORITY_TYPES = new Set([
    "ProfilePage",
    "WebPage",
    "CollectionPage",
]);

const CONTENT_TYPES = new Set([
    ...HIGH_PRIORITY_TYPES,
    ...MEDIUM_PRIORITY_TYPES,
    "WebSite",
    "AboutPage",
    "TVSeries",
    "Person",
    "Organization",
    "MusicGroup",
    "CreativeWork",
]);

const STRUCTURED_KEYS = [
    "@graph",
    "mainEntity",
    "mainEntityOfPage",
    "subjectOf",
    "video",
    "about",
];

const IMAGE_KEYS = [
    "contentUrl",
    "url",
    "thumbnailUrl",
    "@id",
];

const IMAGE_LINK_SELECTORS = [
    'link[rel="image_src"]',
    'link[itemprop="thumbnailUrl"]',
    'link[itemprop="image"]',
];

const YOUTUBE_PROVIDER_HOSTS = new Set([
    "www.youtube.com",
]);

const YOUTUBE_THUMBNAIL_HOSTS = new Set([
    "i.ytimg.com",
    "img.youtube.com",
]);

/* -------------------- TEXT CLEANING -------------------- */

function cleanText(value, maxLength) {
    if (typeof value !== "string") {
        return null;
    }

    const cleaned = value
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (!cleaned) return null;

    // Avoid allocating a character array for short strings.

    if (cleaned.length <= maxLength) {
        return cleaned;
    }

    let result = "";
    let count = 0;

    for (const character of cleaned) {
        if (count >= maxLength) break;

        result += character;
        count++;
    }

    return result;
}

function firstText(values, maxLength) {
    for (const value of values) {
        const text = cleanText(value, maxLength);

        if (text) return text;
    }

    return null;
}

/* -------------------- META TAG INDEX -------------------- */

function createMetaIndex($) {
    const index = new Map();

    $("meta").each((_, element) => {
        const attributes = element.attribs;

        if (!attributes) return;

        const content = attributes.content;

        if (
            typeof content !== "string" || !content.trim()
        ) {
            return;
        }

        const keys = new Set([
            attributes.property,
            attributes.name,
            attributes.itemprop,
        ]);

        for (const key of keys) {
            if (!key) continue;

            const normalized = key
                .trim()
                .toLowerCase();

            if (!SUPPORTED_META_KEYS.has(normalized)) {
                continue;
            }

            let values = index.get(normalized);

            if (!values) {
                values = [];
                index.set(normalized, values);
            }

            if (values.length < 10) {
                values.push(content);
            }
        }
    });

    return index;
}

function* getMetaValues(index, keys) {
    for (const key of keys) {
        const values = index.get(key);

        if (values) {
            yield* values;
        }
    }
}

function getMetaText(index, keys, maxLength) {
    return firstText(getMetaValues(index, keys), maxLength);
}

/* -------------------- STRUCTURED DATA -------------------- */

function getSchemaTypes(value) {
    const types = Array.isArray(value)
        ? value
        : [value];

    return types
        .filter((type) => typeof type === "string")
        .map((type) => type.split(/[\/#]/).pop());
}

function getNodePriority(types) {
    if (
        types.some((type) => HIGH_PRIORITY_TYPES.has(type))
    ) {
        return 3;
    }

    if (
        types.some((type) => MEDIUM_PRIORITY_TYPES.has(type))
    ) {
        return 2;
    }

    return 1;
}

function collectStructuredNodes(value, nodes, budget, depth = 0) {
    if (
        !value ||
        typeof value !== "object" ||
        depth > MAX_JSON_LD_DEPTH ||
        budget.remaining <= 0
    ) {
        return;
    }

    budget.remaining--;

    if (Array.isArray(value)) {
        for (const item of value) {
            if (budget.remaining <= 0) break;

            collectStructuredNodes(item, nodes, budget, depth + 1);
        }

        return;
    }

    const types = getSchemaTypes(value["@type"]);

    if (
        types.some((type) => CONTENT_TYPES.has(type))
    ) {
        nodes.push({
            node: value,
            types,
            priority: getNodePriority(types),
        });
    }

    for (const key of STRUCTURED_KEYS) {
        if (budget.remaining <= 0) break;

        collectStructuredNodes(value[key], nodes, budget, depth + 1);
    }
}

function extractStructuredNodes($) {
    const nodes = [];
    const budget = { remaining: MAX_JSON_LD_NODES };

    $('script[type="application/ld+json"]')
        .slice(0, MAX_JSON_LD_SCRIPTS)
        .each((_, element) => {
            if (budget.remaining <= 0) {
                return false;
            }

            const text = $(element).text().trim();

            if (
                !text ||
                text.length > MAX_JSON_LD_LENGTH
            ) {
                return;
            }

            try {
                collectStructuredNodes(JSON.parse(text), nodes, budget);
            } catch {
                // Ignore malformed structured data.
            }
        });

    return nodes.sort((a, b) => b.priority - a.priority);
}

function getStructuredText(nodes, keys, maxLength) {
    for (const { node } of nodes) {
        for (const key of keys) {
            const text = cleanText(node[key], maxLength);

            if (text) return text;
        }
    }

    return null;
}

function getStructuredSiteName(nodes) {
    for (const { node, types } of nodes) {
        const name = firstText(
            [
                node.publisher?.name,
                node.isPartOf?.name,
                types.includes("WebSite")
                    ? node.name
                    : null,
            ],
            MAX_SITE_NAME_LENGTH
        );

        if (name) return name;
    }

    return null;
}

/* -------------------- IMAGE URL VALIDATION -------------------- */

function resolveImageUrl(value, baseUrl) {
    if (
        typeof value !== "string" || !value.trim()
    ) {
        return null;
    }

    try {
        const url = new URL(value.trim(), baseUrl);

        if (
            url.protocol !== "https:" ||
            url.port ||
            url.username ||
            url.password ||
            !isPreviewAllowed(url.href)
        ) {
            return null;
        }

        return normalizeUrl(url.href);
    } catch {
        return null;
    }
}

/* -------------------- IMAGE CANDIDATES -------------------- */

function* walkImageCandidates(value, depth = 0) {
    if (!value || depth > 4) {
        return;
    }

    if (typeof value === "string") {
        yield value;
        return;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            yield* walkImageCandidates(item, depth + 1);
        }

        return;
    }

    if (typeof value === "object") {
        for (const key of IMAGE_KEYS) {
            yield* walkImageCandidates(value[key], depth + 1);
        }
    }
}

function* getImageCandidates($, metaIndex, getStructuredNodes) {
    yield* getMetaValues(metaIndex, META_KEYS.image);

    for (const { node } of getStructuredNodes()) {
        yield* walkImageCandidates(node.thumbnailUrl);
        yield* walkImageCandidates(node.image);
    }

    for (const selector of IMAGE_LINK_SELECTORS) {
        const href = $(selector)
            .first()
            .attr("href");

        if (href) yield href;
    }
}

function getImageUrl($, metaIndex, getStructuredNodes, finalUrl) {
    const seen = new Set();

    let count = 0;

    for (const candidate of getImageCandidates($, metaIndex, getStructuredNodes)) {
        if (count >= MAX_IMAGE_CANDIDATES) {
            break;
        }

        count++;

        if (seen.has(candidate)) {
            continue;
        }

        seen.add(candidate);

        const url = resolveImageUrl(candidate, finalUrl);

        if (url) return url;
    }

    return null;
}

/* -------------------- METADATA QUALITY -------------------- */

function normalizeComparison(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^www\./, "")
        .replace(/\.$/, "");
}

export function getMetadataQuality(metadata) {
    if (!metadata) {
        return PREVIEW_QUALITY.FAILED;
    }

    const url = metadata.final_url || metadata.url || "";
    const hostname = normalizeComparison(getUrlHostname(url));
    const title = normalizeComparison(metadata.title);
    const hasTitle = Boolean(title && title !== hostname);
    const hasDescription = Boolean(metadata.description?.trim());
    const hasImage = Boolean(metadata.image_url);

    if (
        hasTitle && hasImage &&
        (hasDescription || getYouTubeVideoId(url))
    ) {
        return PREVIEW_QUALITY.COMPLETE;
    }

    return (
        hasTitle ||
        hasDescription ||
        hasImage
    )
        ? PREVIEW_QUALITY.PARTIAL
        : PREVIEW_QUALITY.BASIC;
}

/* -------------------- HTML METADATA -------------------- */

function parseMetadata(html, finalUrl) {
    const $ = load(html);

    const hostname = getUrlHostname(finalUrl);
    const metaIndex = createMetaIndex($);

    let structuredNodes;

    // Parse JSON-LD only when a fallback requires it.

    function getStructuredNodes() {
        return (
            structuredNodes ??= extractStructuredNodes($)
        );
    }

    const title =
        getMetaText(metaIndex, META_KEYS.title, MAX_TITLE_LENGTH) ||
        getStructuredText(getStructuredNodes(), ["headline", "name"], MAX_TITLE_LENGTH) ||
        cleanText($("title").first().text(), MAX_TITLE_LENGTH) ||
        getMetaText(metaIndex, META_KEYS.fallbackTitle, MAX_TITLE_LENGTH) ||
        hostname;

    const description =
        getMetaText(etaIndex, META_KEYS.description, MAX_DESCRIPTION_LENGTH) ||
        getStructuredText(getStructuredNodes(), ["description"], MAX_DESCRIPTION_LENGTH);

    const siteName =
        getMetaText(metaIndex, META_KEYS.siteName, MAX_SITE_NAME_LENGTH) ||
        getStructuredSiteName(getStructuredNodes()) ||
        cleanText(hostname, MAX_SITE_NAME_LENGTH);

    const imageUrl = getImageUrl($, metaIndex, getStructuredNodes, finalUrl);

    return {
        final_url: finalUrl,
        title,
        description,
        image_url: imageUrl,
        site_name: siteName,
    };
}

/* -------------------- YOUTUBE METADATA -------------------- */

function resolveYouTubeThumbnail(value) {
    if (typeof value !== "string") {
        return null;
    }

    try {
        const url = new URL(value);

        if (
            url.protocol !== "https:" ||
            url.port ||
            url.username ||
            url.password ||
            !YOUTUBE_THUMBNAIL_HOSTS.has(url.hostname) ||
            !isPreviewAllowed(url.href)
        ) {
            return null;
        }

        return normalizeUrl(url.href);
    } catch {
        return null;
    }
}

function parseYouTubeMetadata(data, canonicalUrl) {
    if (
        !data || typeof data !== "object" || data.type !== "video"
    ) {
        return null;
    }

    const title = cleanText(data.title, MAX_TITLE_LENGTH);

    if (!title) {
        return null;
    }

    return {
        final_url: canonicalUrl,
        title,
        description: null,
        image_url: resolveYouTubeThumbnail(data.thumbnail_url),
        site_name: cleanText(data.provider_name, MAX_SITE_NAME_LENGTH) || "YouTube",
    };
}

async function extractYouTubeMetadata(value, { timeoutMs = YOUTUBE_FETCH_TIMEOUT } = {}) {
    if (!isPreviewAllowed(value)) {
        return null;
    }

    const canonicalUrl = getCanonicalYouTubeVideoUrl(value);

    if (!canonicalUrl) {
        return null;
    }

    const endpoint = new URL(YOUTUBE_OEMBED_ENDPOINT);

    endpoint.searchParams.set("url", canonicalUrl);
    endpoint.searchParams.set("format", "json");

    const { data } = await safeFetchJson(
        endpoint.href,
        {
            timeoutMs: Math.min(timeoutMs, YOUTUBE_FETCH_TIMEOUT),
            allowedHostnames: YOUTUBE_PROVIDER_HOSTS,
            maxRedirects: 0,
        }
    );

    return parseYouTubeMetadata(data, canonicalUrl);
}

/* -------------------- FETCH AND EXTRACT -------------------- */

export async function extractMetadata(value) {
    if (!isPreviewAllowed(value)) {
        throw new Error("Sensitive preview URL blocked");
    }

    const deadline = performance.now() + METADATA_FETCH_TIMEOUT;

    function remainingTime() {
        const remaining = deadline - performance.now();

        if (remaining <= 0) {
            throw new Error("Metadata extraction timed out");
        }

        return remaining;
    }

    if (getYouTubeVideoId(value)) {
        try {
            const metadata = await extractYouTubeMetadata(value, { timeoutMs: remainingTime() });

            if (metadata) {
                return metadata;
            }
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.warn("[LinkPreview] YouTube provider failed",
                    {
                        name: error?.name,
                        code: error?.cause?.code ?? error?.code,
                    }
                );
            }

            // Continue with standard HTML extraction.
        }
    }

    const { html, finalUrl } = await safeFetchHtml(value, { timeoutMs: remainingTime() });

    return parseMetadata(html, finalUrl);
}