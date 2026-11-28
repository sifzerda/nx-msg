// src/utils/validation.js

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return (
    typeof value === "string" &&
    value.length === 36 &&
    UUID_PATTERN.test(value)
  );
}