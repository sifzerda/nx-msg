// src/utils/previewUrlPolicy.js

import {
  normalizeUrl,
  splitMessageText,
} from "./urlUtils";

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
  "assertion",
  "ticket",
  "authticket",
  "securitytoken",
  "privatekey",
  "clientassertion",
  "passwordtoken",
  "emailtoken",
  "confirmationtoken",
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
  "authorize",
  "authenticate",
  "recoverpassword",
  "accountrecovery",
  "passwordrecovery",
]);

/* -------------------- NORMALISATION -------------------- */

function normalizeIdentifier(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function decodeRepeatedly(value) {
  let decoded = value;

  for (let i = 0; i < 3; i++) {
    if (!/%[a-f0-9]{2}/i.test(decoded)) {
      return decoded;
    }

    const next = decodeURIComponent(decoded);

    if (next === decoded) {
      return decoded;
    }

    decoded = next;
  }

  if (/%[a-f0-9]{2}/i.test(decoded)) {
    throw new Error("Excessive URL encoding");
  }

  return decoded;
}

/* -------------------- PARAMETER POLICY -------------------- */

function isSensitiveParameter(value) {
  const name = normalizeIdentifier(
    decodeRepeatedly(value)
  );

  return (
    SENSITIVE_PARAMETERS.has(name) ||
    SENSITIVE_PARAMETER_PREFIXES.some(
      (prefix) => name.startsWith(prefix)
    )
  );
}

function hasSensitiveParameters(parameters) {
  for (const name of parameters.keys()) {
    if (isSensitiveParameter(name)) {
      return true;
    }
  }

  return false;
}

/* -------------------- PATH POLICY -------------------- */

function hasSensitivePath(pathname) {
  const decoded = decodeRepeatedly(pathname);

  for (const segment of decoded.split(/[/\\;]/)) {
    if (!segment) continue;

    const [name] = segment.split("=");

    if (
      SENSITIVE_PATH_SEGMENTS.has(
        normalizeIdentifier(name)
      ) ||
      (
        segment.includes("=") &&
        isSensitiveParameter(name)
      )
    ) {
      return true;
    }
  }

  return false;
}

/* -------------------- FRAGMENT POLICY -------------------- */

function hasSensitiveFragment(hash) {
  if (!hash) return false;

  const fragment = decodeRepeatedly(
    hash.slice(1)
  );

  const queryIndex = fragment.indexOf("?");

  const path =
    queryIndex === -1
      ? fragment
      : fragment.slice(0, queryIndex);

  const query =
    queryIndex === -1
      ? fragment
      : fragment.slice(queryIndex + 1);

  return (
    hasSensitivePath(path) ||
    hasSensitiveParameters(
      new URLSearchParams(query)
    )
  );
}

/* -------------------- PUBLIC POLICY -------------------- */

export function isPreviewAllowed(value) {
  if (!normalizeUrl(value)) {
    return false;
  }

  try {
    const input = value.trim();

    const url = new URL(
      /^www\./i.test(input)
        ? `https://${input}`
        : input
    );

    return !(
      hasSensitiveParameters(url.searchParams) ||
      hasSensitivePath(url.pathname) ||
      hasSensitiveFragment(url.hash)
    );
  } catch {
    return false;
  }
}

/* -------------------- PREVIEW EXTRACTION -------------------- */

export function getPreviewUrlFromParts(parts) {
  const link = parts.find(
    (part) => part.type === "link"
  );

  if (!link || !isPreviewAllowed(link.url)) {
    return null;
  }

  return normalizeUrl(link.url);
}

export function extractPreviewUrl(content) {
  return getPreviewUrlFromParts(
    splitMessageText(content)
  );
}