/**
 * Convergence anchor — deterministic grounding check for a contribution proposal.
 *
 * Ported from `libre-ai/sessions`, `crates/rag/src/verify.rs`
 * (`validate_exact_evidence`), revision 541a2f61ac97a9848d01e7c4b706e33cf8cb9b68.
 * Behaviour, refusal shape and the constructor-private validated type are kept;
 * the seal is expressed with the module-private WeakSet already used by the
 * classification brick rather than a Rust newtype.
 *
 * WHY IT EXISTS. A model asked "could I be useful here?" answers yes, because the
 * question invites the answer. A proposal therefore proves nothing until it is
 * anchored: it must quote the observed item **verbatim** and name an artefact
 * that resolves in the corpus. A provider's own confidence is not evidence, and
 * is not accepted as input here at all.
 *
 * NO NORMALISATION — the decision most likely to be quietly reversed, so it is
 * stated here and locked by tests. Matching is byte-exact. A quote differing by a
 * doubled space, a capital, or a typographic apostrophe is refused. Normalising
 * would be the tempting fix the first time a legitimate quote bounces, and it is
 * precisely how a quote stops being the source text: once whitespace folds, the
 * next reasonable step folds case, then punctuation, then accents, and the check
 * has become a similarity score wearing the word "verbatim".
 *
 * WHAT IT DOES NOT ESTABLISH, so its acceptance is never read as more than it is:
 * that the quoted passage is TRUE, that it is not itself an injected instruction,
 * or that the convergence is worth acting on. It establishes that the proposal
 * did not invent its source. Defence in depth, not proof.
 */
export interface AnchorSource {
  readonly id: string;
  readonly text: string;
}

export interface ConvergenceClaim {
  readonly sourceId: string;
  readonly quote: string;
  readonly assertions: readonly string[];
  readonly artefactId: string;
}

export type AnchorRefusal =
  | "anchor.source_mismatch"
  | "anchor.quote_empty"
  | "anchor.quote_forges_delimiter"
  | "anchor.quote_too_short"
  | "anchor.quote_not_in_source"
  | "anchor.assertions_empty"
  | "anchor.assertion_not_in_quote"
  | "anchor.artefact_unresolved";

export interface AnchoredEvidence {
  readonly sourceId: string;
  readonly quote: string;
  readonly artefactId: string;
}

export type AnchorVerdict =
  | { readonly anchored: true; readonly evidence: AnchoredEvidence }
  | { readonly anchored: false; readonly refusal: AnchorRefusal };

// Duplicated from the envelope brick, which keeps its delimiters module-private
// by design. Only the literal is repeated, never the logic: this guard refuses a
// marker, it never produces one. If the envelope's delimiters change, this list
// is stale in the safe direction — it would refuse strings that are no longer
// dangerous, never accept ones that became dangerous.
const GUARD_MARKERS: readonly string[] = ["⟦LAI-UNTRUSTED", "⟦/LAI-UNTRUSTED⟧"];

// A quote shorter than this proves nothing: "IA générative" occurs verbatim in
// half the corpus of any AI-related feed and would satisfy a naive containment
// check. The floor is counted in words rather than characters so it means the
// same thing across languages — roughly "a clause, not a term". The Rust origin
// has no floor because its quotes come from a controlled question/answer flow;
// here the source is an arbitrary public item, so the floor is added.
const MINIMUM_QUOTE_WORDS = 5;

// Module-private seal. A structurally identical object — a spread copy, a JSON
// round-trip, a hand-built literal — is not evidence, because membership lives
// outside the value. Same discipline as the classification brick's reliability
// seal.
const ANCHORED = new WeakSet<object>();

export function isAnchored(value: unknown): boolean {
  return typeof value === "object" && value !== null && ANCHORED.has(value);
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Verify one proposal against the single source it claims, fail-closed.
 *
 * Order matters: the checks run from the cheapest and most structural to the
 * most specific, so the refusal returned names the first thing actually wrong
 * rather than a downstream symptom of it.
 */
export function verifyAnchor(
  source: AnchorSource,
  claim: ConvergenceClaim,
  artefacts: ReadonlySet<string>,
): AnchorVerdict {
  const refuse = (refusal: AnchorRefusal): AnchorVerdict => ({ anchored: false, refusal });

  // The quote must come from the source it is attributed to, not from any source.
  if (claim.sourceId !== source.id) return refuse("anchor.source_mismatch");
  if (claim.quote.trim().length === 0) return refuse("anchor.quote_empty");
  if (GUARD_MARKERS.some((marker) => claim.quote.includes(marker))) {
    return refuse("anchor.quote_forges_delimiter");
  }
  if (wordCount(claim.quote) < MINIMUM_QUOTE_WORDS) return refuse("anchor.quote_too_short");
  if (!source.text.includes(claim.quote)) return refuse("anchor.quote_not_in_source");

  if (claim.assertions.length === 0) return refuse("anchor.assertions_empty");
  // Every assertion must be borne by the QUOTE, not merely by the source. Quoting
  // one passage and asserting something the source happens to say elsewhere is
  // the failure this component exists to stop.
  for (const assertion of claim.assertions) {
    if (assertion.trim().length === 0 || !claim.quote.includes(assertion)) {
      return refuse("anchor.assertion_not_in_quote");
    }
  }

  if (!artefacts.has(claim.artefactId)) return refuse("anchor.artefact_unresolved");

  const evidence: AnchoredEvidence = Object.freeze({
    sourceId: claim.sourceId,
    quote: claim.quote,
    artefactId: claim.artefactId,
  });
  ANCHORED.add(evidence);
  return { anchored: true, evidence };
}
