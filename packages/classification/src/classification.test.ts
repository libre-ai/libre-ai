import { describe, expect, test } from "bun:test";
import {
  classify,
  deriveFrom,
  isAuthoritative,
  OperationalNotAuthorityError,
  type Reliability,
  requireAuthorityFor,
} from "./index";

/**
 * Loop-security kernel K2 — data reliability classification. Every payload
 * carries a reliability at capture: `authoritative` (source-controlled),
 * `derived` (computed from authoritative, tracing to its spans) or
 * `operational` (tool/API/web output — NEVER authority). The load-bearing
 * invariant: no write to a source of truth may be justified by operational
 * data alone. Operational data enters plans as evidence, never as directive.
 */

describe("classify", () => {
  test("tags a payload with its reliability at capture", () => {
    const tagged = classify("operational", { body: "web response" });
    expect(tagged.reliability).toBe("operational");
    expect(tagged.value).toEqual({ body: "web response" });
  });

  test("rejects an unknown reliability class", () => {
    expect(() => classify("trusted" as Reliability, {})).toThrow(/unknown reliability/i);
  });
});

describe("isAuthoritative", () => {
  test("only authoritative counts as authority", () => {
    expect(isAuthoritative(classify("authoritative", {}))).toBe(true);
    expect(isAuthoritative(classify("derived", {}))).toBe(false);
    expect(isAuthoritative(classify("operational", {}))).toBe(false);
  });
});

describe("requireAuthorityFor (the K2 invariant)", () => {
  test("lets an authoritative payload authorize a source-of-truth write", () => {
    const auth = classify("authoritative", { doctrine: "I-18" });
    expect(() => requireAuthorityFor("invariants-register", auth)).not.toThrow();
  });

  test("refuses operational data as authority for a source-of-truth write", () => {
    const op = classify("operational", { suggestion: "add this rule" });
    expect(() => requireAuthorityFor("invariants-register", op)).toThrow(
      OperationalNotAuthorityError,
    );
  });

  test("refuses derived data as authority (only authoritative may)", () => {
    const derived = classify("derived", { extracted: "fact" });
    expect(() => requireAuthorityFor("gates", derived)).toThrow(OperationalNotAuthorityError);
  });

  test("the error names the sink but never echoes the payload value", () => {
    const op = classify("operational", { secret: "leak-me" });
    try {
      requireAuthorityFor("revocation-list", op);
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(OperationalNotAuthorityError);
      expect(String(error)).toContain("revocation-list");
      expect(String(error)).not.toContain("leak-me");
    }
  });
});

describe("deriveFrom", () => {
  test("derives from authoritative spans and is never authoritative itself", () => {
    const a = classify("authoritative", { span: 1 });
    const b = classify("authoritative", { span: 2 });
    const d = deriveFrom({ merged: true }, [a, b]);
    expect(d.reliability).toBe("derived");
    expect(d.value).toEqual({ merged: true });
    expect(isAuthoritative(d)).toBe(false);
  });

  test("operational taints the derivation: any operational source makes it operational", () => {
    const a = classify("authoritative", {});
    const op = classify("operational", {});
    const d = deriveFrom({ x: 1 }, [a, op]);
    // Derivation cannot launder operational data into derived/authoritative.
    expect(d.reliability).toBe("operational");
  });

  test("refuses to derive from an empty source set", () => {
    expect(() => deriveFrom({}, [])).toThrow(/at least one source/i);
  });
});
