/**
 * Loop-security kernel K2 — data reliability classification.
 *
 * Every payload carries a reliability at capture:
 * - `authoritative` — source-controlled (signed Git commits, Biscuit-verified
 *   decisions, the invariants register);
 * - `derived` — computed from authoritative data, tracing to its spans;
 * - `operational` — tool outputs, API and web responses, git logs. NEVER
 *   authority.
 *
 * The load-bearing invariant: no write to a source of truth (doctrine, gates,
 * revocation list, permission vocabulary, contracts) may be justified by
 * `operational` data alone. Operational data enters plans as evidence, never
 * as directive — facts are never commands.
 */

const RELIABILITIES = ["authoritative", "derived", "operational"] as const;
export type Reliability = (typeof RELIABILITIES)[number];

export interface Classified<T> {
  readonly reliability: Reliability;
  readonly value: T;
}

export class OperationalNotAuthorityError extends Error {
  constructor(sink: string, reliability: Reliability) {
    // Names the sink and the offending class, never the payload value.
    super(`${reliability} data may not authorize a write to ${sink} (K2: only authoritative may)`);
    this.name = "OperationalNotAuthorityError";
  }
}

function isReliability(value: string): value is Reliability {
  return (RELIABILITIES as readonly string[]).includes(value);
}

export function classify<T>(reliability: Reliability, value: T): Classified<T> {
  if (!isReliability(reliability)) {
    throw new RangeError(`unknown reliability class ${JSON.stringify(reliability)}`);
  }
  return { reliability, value };
}

export function isAuthoritative<T>(payload: Classified<T>): boolean {
  return payload.reliability === "authoritative";
}

/**
 * The K2 gate: only an authoritative payload may authorize a write to a source
 * of truth. Derived and operational data are refused, fail-closed.
 */
export function requireAuthorityFor<T>(sink: string, payload: Classified<T>): void {
  if (payload.reliability !== "authoritative") {
    throw new OperationalNotAuthorityError(sink, payload.reliability);
  }
}

/**
 * Derive a new payload from a non-empty set of sources. The result is at most
 * `derived`, and any `operational` source taints it to `operational`:
 * derivation can never launder operational data into authority.
 */
export function deriveFrom<T>(value: T, sources: readonly Classified<unknown>[]): Classified<T> {
  if (sources.length === 0) {
    throw new RangeError("a derivation requires at least one source");
  }
  const reliability: Reliability = sources.some((s) => s.reliability === "operational")
    ? "operational"
    : "derived";
  return { reliability, value };
}
