/**
 * Restore replay (DATA-LIFECYCLE.md, explicit deletion §7).
 *
 * "Restore procedures replay deletion receipts before reopening service."
 * An accepted deletion — a receipt whose status is `complete` — must never
 * resurrect when an encrypted backup is restored. Replay removes every restored
 * subject whose opaque digest appears in a completed receipt. Only accepted
 * deletions replay; an in-flight receipt does not remove data.
 */
export interface DeletionReceiptLike {
  readonly subjectDigests: readonly string[];
  readonly status: string;
}

const ACCEPTED_STATUS = "complete";

export function replayDeletionsOnRestore(
  restoredDigests: readonly string[],
  receipts: readonly DeletionReceiptLike[],
): string[] {
  const deleted = new Set<string>();
  for (const receipt of receipts) {
    if (receipt.status !== ACCEPTED_STATUS) {
      continue;
    }
    for (const digest of receipt.subjectDigests) {
      deleted.add(digest);
    }
  }
  return restoredDigests.filter((digest) => !deleted.has(digest));
}
