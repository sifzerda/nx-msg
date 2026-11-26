// src/lib/server/extractMetadata.js

import "server-only";

import { load } from "cheerio";
import { safeFetchHtml } from "./safeFetch";
import { normalizeUrl, getUrlHostname } from "@/utils/urlUtils";
import {
    MAX_TITLE_LENGTH,
    MAX_DESCRIPTION_LENGTH,
    MAX_SITE_NAME_LENGTH,
    MAX_JSON_LD_SCRIPTS,
    MAX_JSON_LD_LENGTH,
    MAX_JSON_LD_NODES,
    MAX_JSON_LD_DEPTH,
    MAX_IMAGE_CANDIDATES,
    PREVIEW_QUALITY,
} from "@/constants/linkPreviews";
import {
    extractYouTubeMetadata,
} from "./providers/youtube";

import {
    getYouTubeVideoId,
} from "@/utils/youtubeUtils";

/* -------------------- STRUCTURED DATA TYPES -------------------- */

const CONTENT_TYPES = new Set([
    "WebPage",
    "WebSite",
    "ProfilePage",
    "AboutPage",
    "Article",
    "NewsArticle",
    "BlogPosting",
    "VideoObject",
    "MusicVideoObject",
    "MusicRecording",
    "MusicAlbum",
    "Product",
    "Movie",
    "TVSeries",
    "Person",
    "Organization",
    "MusicGroup",
    "CreativeWork",
    "CollectionPage",
]);

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
};

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

    if (!cleaned) {
        return null;
    }

    return Array.from(cleaned)
        .slice(0, maxLength)
        .join("");
}

function firstText(values, maxLength) {
    for (const value of values) {
        const cleaned = cleanText(
            value,
            maxLength
        );

        if (cleaned) {
            return cleaned;
        }
    }

    return null;
}

/* -------------------- META TAG INDEX -------------------- */

function createMetaIndex($) {
    const index = new Map();

    $("meta").each((_, element) => {
        const meta = $(element);

        const content = meta.attr("content");

        if (
            typeof content !== "string" ||
            !content.trim()
        ) {
            return;
        }

        const keys = [
            meta.attr("property"),
            meta.attr("name"),
            meta.attr("itemprop"),
        ];

        for (const key of keys) {
            if (!key) continue;

            const normalizedKey =
                key.trim().toLowerCase();

            let values = index.get(normalizedKey);

            if (!values) {
                values = [];

                index.set(normalizedKey, values);
            }

            // Prevent excessive duplicate metadata.

            if (values.length < 10) {
                values.push(content);
            }
        }
    });

    return index;
}

function getMetaValues(index, keys) {
    const values = [];

    for (const key of keys) {
        const matches = index.get(
            key.toLowerCase()
        );

        if (matches) {
            values.push(...matches);
        }
    }

    return values;
}

/* -------------------- JSON-LD HELPERS -------------------- */

function getSchemaTypes(value) {
    const types = Array.isArray(value)
        ? value
        : [value];

    return types
        .filter((type) => typeof type === "string")
        .map((type) => {
            return type.split(/[\/#]/).pop();
        });
}

function isContentNode(node) {
    return getSchemaTypes(node["@type"]).some(
        (type) => CONTENT_TYPES.has(type)
    );
}

function collectStructuredNodes(
    value,
    nodes,
    budget,
    depth = 0
) {
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

            collectStructuredNodes(
                item,
                nodes,
                budget,
                depth + 1
            );
        }

        return;
    }

    if (isContentNode(value)) {
        nodes.push(value);
    }

    const nestedKeys = [
        "@graph",
        "mainEntity",
        "mainEntityOfPage",
        "subjectOf",
        "video",
        "about",
    ];

    for (const key of nestedKeys) {
        if (budget.remaining <= 0) break;

        collectStructuredNodes(
            value[key],
            nodes,
            budget,
            depth + 1
        );
    }
}

function extractStructuredNodes($) {
    const nodes = [];

    const budget = {
        remaining: MAX_JSON_LD_NODES,
    };

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
                const parsed = JSON.parse(text);

                collectStructuredNodes(
                    parsed,
                    nodes,
                    budget
                );
            } catch {
                // Invalid JSON-LD should not prevent
                // normal metadata extraction.
            }
        });

    return nodes;
}

/* -------------------- STRUCTURED DATA PRIORITY -------------------- */

function getNodePriority(node) {
    const types = getSchemaTypes(node["@type"]);

    if (
        types.some((type) =>
            [
                "VideoObject",
                "MusicVideoObject",
                "Article",
                "NewsArticle",
                "BlogPosting",
                "Product",
                "MusicAlbum",
                "MusicRecording",
                "Movie",
            ].includes(type)
        )
    ) {
        return 3;
    }

    if (
        types.some((type) =>
            [
                "ProfilePage",
                "WebPage",
                "CollectionPage",
            ].includes(type)
        )
    ) {
        return 2;
    }

    return 1;
}

function getStructuredText(
    nodes,
    keys,
    maxLength
) {
    for (const node of nodes) {
        const values = keys.map(
            (key) => node[key]
        );

        const text = firstText(
            values,
            maxLength
        );

        if (text) return text;
    }

    return null;
}

function getStructuredSiteName(nodes) {
    for (const node of nodes) {
        const name = firstText(
            [
                node.publisher?.name,
                node.isPartOf?.name,
            ],
            MAX_SITE_NAME_LENGTH
        );

        if (name) {
            return name;
        }

        if (
            getSchemaTypes(node["@type"])
                .includes("WebSite")
        ) {
            const websiteName = cleanText(
                node.name,
                MAX_SITE_NAME_LENGTH
            );

            if (websiteName) {
                return websiteName;
            }
        }
    }

    return null;
}

/* -------------------- IMAGE URL EXTRACTION -------------------- */

function resolveImageUrl(value, baseUrl) {
    if (typeof value !== "string") {
        return null;
    }

    const input = value.trim();

    if (!input) {
        return null;
    }

    try {
        const url = new URL(input, baseUrl);

        if (
            url.protocol !== "https:" ||
            url.username ||
            url.password
        ) {
            return null;
        }

        return normalizeUrl(url.href);
    } catch {
        return null;
    }
}

function collectImageCandidates(
    value,
    candidates,
    depth = 0
) {
    if (
        !value ||
        depth > 4 ||
        candidates.length >= MAX_IMAGE_CANDIDATES
    ) {
        return;
    }

    if (typeof value === "string") {
        candidates.push(value);

        return;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            if (
                candidates.length >=
                MAX_IMAGE_CANDIDATES
            ) {
                break;
            }

            collectImageCandidates(
                item,
                candidates,
                depth + 1
            );
        }

        return;
    }

    if (typeof value === "object") {
        const keys = [
            "contentUrl",
            "url",
            "thumbnailUrl",
            "@id",
        ];

        for (const key of keys) {
            collectImageCandidates(
                value[key],
                candidates,
                depth + 1
            );
        }
    }
}

function getImageUrl(
    $,
    metaIndex,
    structuredNodes,
    finalUrl
) {
    const candidates = [];

    collectImageCandidates(
        getMetaValues(
            metaIndex,
            META_KEYS.image
        ),
        candidates
    );

    for (const node of structuredNodes) {
        collectImageCandidates(
            node.thumbnailUrl,
            candidates
        );

        collectImageCandidates(
            node.image,
            candidates
        );

        if (
            candidates.length >=
            MAX_IMAGE_CANDIDATES
        ) {
            break;
        }
    }

    collectImageCandidates(
        [
            $('link[rel="image_src"]')
                .first()
                .attr("href"),

            $('link[itemprop="thumbnailUrl"]')
                .first()
                .attr("href"),

            $('link[itemprop="image"]')
                .first()
                .attr("href"),
        ],
        candidates
    );

    const seen = new Set();

    for (const candidate of candidates) {
        if (seen.has(candidate)) {
            continue;
        }

        seen.add(candidate);

        const url = resolveImageUrl(
            candidate,
            finalUrl
        );

        if (url) {
            return url;
        }
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

    const hostname = normalizeComparison(
        getUrlHostname(
            metadata.final_url ||
            metadata.url ||
            ""
        )
    );

    const title = normalizeComparison(
        metadata.title
    );

    const hasTitle = Boolean(
        title && title !== hostname
    );

    const hasDescription = Boolean(
        metadata.description?.trim()
    );

    const hasImage = Boolean(
        metadata.image_url
    );

    const isYouTubeVideo = Boolean(
        getYouTubeVideoId(
            metadata.final_url ||
            metadata.url ||
            ""
        )
    );

    if (
        isYouTubeVideo &&
        hasTitle &&
        hasImage
    ) {
        return PREVIEW_QUALITY.COMPLETE;
    }

    if (
        hasTitle &&
        hasDescription &&
        hasImage
    ) {
        return PREVIEW_QUALITY.COMPLETE;
    }

    if (
        hasTitle ||
        hasDescription ||
        hasImage
    ) {
        return PREVIEW_QUALITY.PARTIAL;
    }

    return PREVIEW_QUALITY.BASIC;
}

/* -------------------- HTML EXTRACTION -------------------- */

export function parseMetadata(html, finalUrl) {
    const $ = load(html);

    const hostname = getUrlHostname(finalUrl);

    const metaIndex = createMetaIndex($);

    const structuredNodes =
        extractStructuredNodes($).sort(
            (a, b) =>
                getNodePriority(b) -
                getNodePriority(a)
        );

    const title = firstText(
        [
            ...getMetaValues(
                metaIndex,
                META_KEYS.title
            ),

            getStructuredText(
                structuredNodes,
                ["headline", "name"],
                MAX_TITLE_LENGTH
            ),

            $("title").first().text(),

            ...getMetaValues(
                metaIndex,
                ["headline", "name"]
            ),
        ],
        MAX_TITLE_LENGTH
    );

    const description = firstText(
        [
            ...getMetaValues(
                metaIndex,
                META_KEYS.description
            ),

            getStructuredText(
                structuredNodes,
                ["description"],
                MAX_DESCRIPTION_LENGTH
            ),
        ],
        MAX_DESCRIPTION_LENGTH
    );

    const siteName = firstText(
        [
            ...getMetaValues(
                metaIndex,
                META_KEYS.siteName
            ),

            getStructuredSiteName(
                structuredNodes
            ),

            hostname,
        ],
        MAX_SITE_NAME_LENGTH
    );

    const imageUrl = getImageUrl(
        $,
        metaIndex,
        structuredNodes,
        finalUrl
    );

    return {
        final_url: finalUrl,

        title: title || hostname,

        description,

        image_url: imageUrl,

        site_name: siteName,
    };
}

/* -------------------- FETCH AND EXTRACT -------------------- */

/* -------------------- FETCH AND EXTRACT -------------------- */

export async function extractMetadata(value) {
    const videoId = getYouTubeVideoId(value);

    if (videoId) {
        try {
            const metadata =
                await extractYouTubeMetadata(value);

            if (metadata) {
                return metadata;
            }
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.warn(
                    "[LinkPreview] YouTube provider failed",
                    {
                        name: error.name,
                        code:
                            error.cause?.code ??
                            error.code,
                    }
                );
            }

            // Continue with standard HTML extraction.
        }
    }

    const { html, finalUrl } =
        await safeFetchHtml(value);

    return parseMetadata(
        html,
        finalUrl
    );
}