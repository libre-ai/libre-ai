import { createHash, sign as edSign, verify as edVerify, type KeyObject } from "node:crypto";

/**
 * Provenance brick (couche 3) — AgentContributorLineage v1 (BOT-C).
 *
 * Records who contributed to a subject (agents + roles + per-contribution
 * digests) and signs a canonical digest of the record with **Ed25519**:
 * asymmetric origin authentication (unlike the envelope's symmetric HMAC —
 * anyone with the public key verifies, only the signing-key holder produces).
 * The digest is length-prefixed so no field boundary can be shifted by
 * content. Fails closed on any tamper or wrong key.
 *
 * The production signing key is an owner key ceremony (deferred, WP-G2-Z01 /
 * decision P3) — this brick takes the key as a parameter; dev keys drive tests.
 */

export const LINEAGE_SCHEMA_VERSION = "libre-ai.agent-contributor-lineage.v1" as const;

const ROLES = ["author", "executor", "fixer", "editor"] as const;
export type ContributorRole = (typeof ROLES)[number];

const SHA256 = /^[a-f0-9]{64}$/;

export interface ContributorInput {
  readonly agentId: string;
  readonly roles: readonly ContributorRole[];
  readonly contributionDigest: string;
}

export interface ObservationRef {
  readonly id: string;
  readonly digest: string;
  readonly mediaType: string;
}

export interface LineageInput {
  readonly id: string;
  readonly tenantId: string;
  readonly missionId: string;
  readonly subjectDigest: string;
  readonly contributors: readonly ContributorInput[];
  readonly observations: readonly ObservationRef[];
  readonly generatedAt: string;
}

export interface Contributor {
  readonly agentId: string;
  readonly roles: readonly ContributorRole[];
  readonly contributionDigest: string;
}

export interface AgentContributorLineage {
  readonly schemaVersion: typeof LINEAGE_SCHEMA_VERSION;
  readonly id: string;
  readonly tenantId: string;
  readonly missionId: string;
  readonly subjectDigest: string;
  readonly contributors: readonly Contributor[];
  readonly observations: readonly ObservationRef[];
  readonly generatedAt: string;
  readonly signingKeyId: string;
  readonly lineageDigest: string;
  readonly signature: string;
}

export interface SigningKey {
  readonly id: string;
  readonly privateKey: KeyObject;
}

export interface VerifyKey {
  readonly id: string;
  readonly publicKey: KeyObject;
}

export class LineageIntegrityError extends Error {
  constructor() {
    super("lineage integrity verification failed");
    this.name = "LineageIntegrityError";
  }
}

const encoder = new TextEncoder();

function assertDigest(value: string, what: string): void {
  if (!SHA256.test(value)) {
    throw new RangeError(`${what} must be an opaque SHA-256 digest`);
  }
}

function assertUnique(keys: readonly string[], what: string): void {
  if (new Set(keys).size !== keys.length) {
    throw new RangeError(`duplicate ${what} in a lineage record`);
  }
}

function sortedRoles(roles: readonly ContributorRole[]): ContributorRole[] {
  // Roles are a set: sort by the fixed role order so ordering does not change
  // the digest, and reject unknown roles.
  const seen = new Set<ContributorRole>();
  for (const role of roles) {
    if (!(ROLES as readonly string[]).includes(role)) {
      throw new RangeError(`unknown contributor role ${JSON.stringify(role)}`);
    }
    seen.add(role);
  }
  return ROLES.filter((role) => seen.has(role));
}

function canonicalBytes(fields: readonly string[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const field of fields) {
    const bytes = encoder.encode(field);
    parts.push(encoder.encode(`${bytes.length}:`));
    parts.push(bytes);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function lineageContent(record: {
  id: string;
  tenantId: string;
  missionId: string;
  subjectDigest: string;
  contributors: readonly Contributor[];
  observations: readonly ObservationRef[];
  generatedAt: string;
  signingKeyId: string;
}): string[] {
  const fields: string[] = [
    LINEAGE_SCHEMA_VERSION,
    record.id,
    record.tenantId,
    record.missionId,
    record.subjectDigest,
    record.signingKeyId,
    record.generatedAt,
    String(record.contributors.length),
  ];
  for (const c of record.contributors) {
    fields.push(c.agentId, c.roles.join(","), c.contributionDigest);
  }
  fields.push(String(record.observations.length));
  for (const o of record.observations) {
    fields.push(o.id, o.digest, o.mediaType);
  }
  return fields;
}

function computeLineageDigest(fields: readonly string[]): string {
  return createHash("sha256").update(canonicalBytes(fields)).digest("hex");
}

export function buildLineage(input: LineageInput, key: SigningKey): AgentContributorLineage {
  assertDigest(input.subjectDigest, "subjectDigest");
  if (input.observations.length === 0) {
    throw new RangeError("a lineage record requires at least one observation");
  }
  for (const o of input.observations) {
    assertDigest(o.digest, "observation digest");
  }
  const contributors: Contributor[] = input.contributors.map((c) => {
    assertDigest(c.contributionDigest, "contributionDigest");
    return {
      agentId: c.agentId,
      roles: sortedRoles(c.roles),
      contributionDigest: c.contributionDigest,
    };
  });
  // The schema forbids duplicate contributors and observations (uniqueItems).
  // Reject them fail-closed rather than silently dedup — a duplicate signals a
  // caller error, not a normalization case (review P-01).
  assertUnique(
    contributors.map((c) => `${c.agentId}${c.roles.join(",")}${c.contributionDigest}`),
    "contributor",
  );
  assertUnique(
    input.observations.map((o) => `${o.id}${o.digest}${o.mediaType}`),
    "observation",
  );
  const scaffold = {
    id: input.id,
    tenantId: input.tenantId,
    missionId: input.missionId,
    subjectDigest: input.subjectDigest,
    contributors,
    observations: [...input.observations],
    generatedAt: input.generatedAt,
    signingKeyId: key.id,
  };
  const lineageDigest = computeLineageDigest(lineageContent(scaffold));
  // Sign the digest bytes (hex) with Ed25519.
  const signature = edSign(null, encoder.encode(lineageDigest), key.privateKey).toString(
    "base64url",
  );
  return {
    schemaVersion: LINEAGE_SCHEMA_VERSION,
    ...scaffold,
    lineageDigest,
    signature,
  };
}

export function verifyLineage(
  record: AgentContributorLineage,
  key: VerifyKey,
): { readonly valid: true } {
  if (record.schemaVersion !== LINEAGE_SCHEMA_VERSION) {
    throw new LineageIntegrityError();
  }
  // Recompute the digest from the content: a tampered field changes it.
  const expectedDigest = computeLineageDigest(lineageContent(record));
  if (expectedDigest !== record.lineageDigest) {
    throw new LineageIntegrityError();
  }
  let ok: boolean;
  try {
    ok = edVerify(
      null,
      encoder.encode(record.lineageDigest),
      key.publicKey,
      Buffer.from(record.signature, "base64url"),
    );
  } catch {
    throw new LineageIntegrityError();
  }
  if (!ok) {
    throw new LineageIntegrityError();
  }
  return { valid: true };
}
