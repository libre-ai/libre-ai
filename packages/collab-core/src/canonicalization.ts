import { createHash } from "node:crypto";

/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) — deterministic JSON serialization.
 *
 * Serializes a value to a canonical JSON byte representation that:
 * - Uses UTF-8 encoding
 * - Omits whitespace (space, tab, newline, carriage return)
 * - Sorts object keys in lexicographic order (the primary difference from standard JSON.stringify)
 * - Escapes special characters consistently
 *
 * Two values that compare equal via deep-equals will have identical canonical
 * serialization, making this suitable for checksums, signatures, and content hashing.
 *
 * This is a minimal, spec-compliant implementation. See RFC 8785 Section 3 for the algorithm.
 */
export function canonicalJson(value: unknown): string {
  return canonicalJsonValue(value);
}

/**
 * Return the UTF-8 bytes of the canonical JSON representation.
 */
export function canonicalJsonBytes(value: unknown): Uint8Array {
  const json = canonicalJson(value);
  return new TextEncoder().encode(json);
}

/**
 * Compute SHA-256 digest of canonical JSON bytes, returned as a hex string.
 */
export function sha256Digest(bytes: Uint8Array): string {
  const hash = createHash("sha256").update(bytes).digest("hex");
  return hash;
}

/**
 * Internal: serialize a single value per RFC 8785.
 */
function canonicalJsonValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Number must be finite, got ${value}`);
    }
    // RFC 8785: use decimal notation; JavaScript's JSON.stringify produces the same.
    const str = JSON.stringify(value);
    return str;
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((v) => canonicalJsonValue(v));
    return `[${items.join(",")}]`;
  }
  if (typeof value === "object") {
    // Object (dict): sort keys lexicographically and serialize.
    const keys = Object.keys(value).sort();
    const pairs = keys.map((k) => {
      const v = (value as Record<string, unknown>)[k];
      return `${JSON.stringify(k)}:${canonicalJsonValue(v)}`;
    });
    return `{${pairs.join(",")}}`;
  }
  throw new TypeError(`Unsupported type: ${typeof value}`);
}
