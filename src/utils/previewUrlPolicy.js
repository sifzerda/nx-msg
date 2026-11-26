// src/utils/previewUrlPolicy.js

import { normalizeUrl } from "./urlUtils";

/* -------------------- SENSITIVE PARAMETERS -------------------- */

const SENSITIVE_PARAMETERS = new Set([
    "token",
    "accesstoken",
    "refreshtoken",
    "idtoken",
    "authtoken",
    "authorization",
    "auth",
    "apikey",
    "accesskey",
    "secret",
    "clientsecret",
    "password",
    "passwd",
    "credential",
    "credentials",
    "session",
    "sessionid",
    "sessiontoken",
    "signature",
    "sig",
    "signed",
    "code",
    "otp",
    "verificationcode",
    "resetcode",
    "resettoken",
    "verificationtoken",
    "invitetoken",
    "nonce",
    "jwt",
    "samlresponse",
    "relaystate",
    "policy",
    "keypairid",
]);

const SENSITIVE_PARAMETER_PREFIXES = [
    "xamz",
    "xgoog",
    "xms",
];

/* -------------------- SENSITIVE PATHS -------------------- */

const SENSITIVE_PATH_SEGMENTS = new Set([
    "auth",
    "oauth",
    "oauth2",
    "callback",
    "login",
    "signin",
    "logout",
    "signout",
    "reset",
    "resetpassword",
    "passwordreset",
    "forgotpassword",
    "changepassword",
    "verify",
    "verifyemail",
    "emailverification",
    "activate",
    "activation",
    "magiclink",
    "invite",
    "invitation",
    "unsubscribe",
    "confirmemail",
    "confirmaccount",
]);

/* -------------------- NORMALISATION -------------------- */

function normalizeIdentifier(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

/* -------------------- PARAMETER VALIDATION -------------------- */

function hasSensitiveParameters(parameters) {
    for (const name of parameters.keys()) {
        const normalized = normalizeIdentifier(name);

        if (SENSITIVE_PARAMETERS.has(normalized)) {
            return true;
        }

        if (
            SENSITIVE_PARAMETER_PREFIXES.some(
                (prefix) => normalized.startsWith(prefix)
            )
        ) {
            return true;
        }
    }

    return false;
}

/* -------------------- PATH VALIDATION -------------------- */

function hasSensitivePath(pathname) {
    let decoded;

    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        return true;
    }

    return decoded
        .split("/")
        .filter(Boolean)
        .some((segment) =>
            SENSITIVE_PATH_SEGMENTS.has(
                normalizeIdentifier(segment)
            )
        );
}

/* -------------------- PUBLIC POLICY -------------------- */

export function isPreviewAllowed(value) {
    const normalized = normalizeUrl(value);

    if (!normalized) {
        return false;
    }

    try {
        const url = new URL(normalized);

        if (hasSensitiveParameters(url.searchParams)) {
            return false;
        }

        if (hasSensitivePath(url.pathname)) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}