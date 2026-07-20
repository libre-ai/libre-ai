import { describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import {
  buildLineage,
  type LineageInput,
  LineageIntegrityError,
  type SigningKey,
  type VerifyKey,
  verifyLineage,
} from "./index";

/**
 * Provenance brick (couche 3): builds and verifies AgentContributorLineage v1
 * records — the BOT-C contribution lineage. The lineage digest is signed with
 * Ed25519 (asymmetric origin authentication, unlike the envelope's symmetric
 * HMAC). Dev keys here; the production signing key is an owner key ceremony
 * (deferred, WP-G2-Z01 / P3).
 */

function devKeys(id: string): { signing: SigningKey; verify: VerifyKey } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { signing: { id, privateKey }, verify: { id, publicKey } };
}

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);

const INPUT: LineageInput = {
  id: "urn:libre-ai:lineage:rec-1",
  tenantId: "ten_aaaaaaaaaaaaaaaa",
  missionId: "urn:libre-ai:mission:m-1",
  subjectDigest: DIGEST_A,
  contributors: [
    { agentId: "agent_forge_01", roles: ["author", "fixer"], contributionDigest: DIGEST_B },
  ],
  observations: [
    { id: "urn:libre-ai:artifact:pr-137", digest: DIGEST_A, mediaType: "text/markdown" },
  ],
  generatedAt: "2026-07-20T00:00:00.000Z",
};

describe("buildLineage", () => {
  test("produces a schema-shaped, signed record", () => {
    const { signing } = devKeys("provkey_01");
    const rec = buildLineage(INPUT, signing);
    expect(rec.schemaVersion).toBe("libre-ai.agent-contributor-lineage.v1");
    expect(rec.signingKeyId).toBe("provkey_01");
    expect(rec.lineageDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(rec.signature).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(rec.contributors[0]?.roles).toEqual(["author", "fixer"]);
  });

  test("the lineage digest is deterministic and order-independent in roles", () => {
    const { signing } = devKeys("provkey_01");
    const a = buildLineage(INPUT, signing);
    const b = buildLineage(
      { ...INPUT, contributors: [{ ...INPUT.contributors[0]!, roles: ["fixer", "author"] }] },
      signing,
    );
    // Roles are a set — order must not change the digest.
    expect(a.lineageDigest).toBe(b.lineageDigest);
  });

  test("rejects a non-opaque subject digest", () => {
    const { signing } = devKeys("provkey_01");
    expect(() => buildLineage({ ...INPUT, subjectDigest: "not-a-digest" }, signing)).toThrow(
      /digest/i,
    );
  });

  test("rejects an empty observation set (schema minItems 1)", () => {
    const { signing } = devKeys("provkey_01");
    expect(() => buildLineage({ ...INPUT, observations: [] }, signing)).toThrow(/observation/i);
  });
});

describe("verifyLineage", () => {
  test("accepts an intact record under the right key", () => {
    const { signing, verify } = devKeys("provkey_01");
    const rec = buildLineage(INPUT, signing);
    expect(verifyLineage(rec, verify)).toEqual({ valid: true });
  });

  test("detects a tampered contributor digest (digest + signature both fail)", () => {
    const { signing, verify } = devKeys("provkey_01");
    const rec = buildLineage(INPUT, signing);
    const tampered = {
      ...rec,
      contributors: [{ ...rec.contributors[0]!, contributionDigest: "c".repeat(64) }],
    };
    expect(() => verifyLineage(tampered, verify)).toThrow(LineageIntegrityError);
  });

  test("detects a recomputed digest with a stale signature", () => {
    const { signing, verify } = devKeys("provkey_01");
    const rec = buildLineage(INPUT, signing);
    // Attacker fixes the digest to match the tamper but cannot re-sign.
    const forged = { ...rec, lineageDigest: "d".repeat(64) };
    expect(() => verifyLineage(forged, verify)).toThrow(LineageIntegrityError);
  });

  test("fails closed under a different key", () => {
    const { signing } = devKeys("provkey_01");
    const other = devKeys("provkey_02");
    const rec = buildLineage(INPUT, signing);
    expect(() => verifyLineage(rec, other.verify)).toThrow(LineageIntegrityError);
  });

  test("the error discloses no contribution content", () => {
    const { signing, verify } = devKeys("provkey_01");
    const rec = buildLineage(INPUT, signing);
    const tampered = { ...rec, subjectDigest: "e".repeat(64) };
    try {
      verifyLineage(tampered, verify);
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(LineageIntegrityError);
      expect(String(error)).not.toContain("e".repeat(64));
    }
  });
});
