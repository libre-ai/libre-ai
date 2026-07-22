import { LoroDoc, type LoroList, type LoroMap, type LoroText } from "loro-crdt";
import { canonicalJsonBytes, sha256Digest } from "./canonicalization";

/**
 * An opaque CRDT version marker. It is Loro's oplog version vector; consumers
 * treat it as an opaque token to pass back into `exportDeltaSince`. Phase B may
 * serialize it (it exposes `.encode()`), but Phase A keeps it opaque.
 */
export type CollabVersion = ReturnType<LoroDoc["oplogVersion"]>;

/**
 * The status of an `importDelta` call.
 * - `success`: the bytes were a well-formed update/snapshot and were applied.
 * - `pending`: some imported ops reference changes not yet present, so they are
 *   buffered until their dependencies arrive (a normal out-of-order-sync state).
 */
export interface ImportResult {
  readonly success: boolean;
  readonly pending: boolean;
}

/**
 * CollabDocument — crypto-free, transport-free CRDT wrapper around Loro.
 *
 * This is Phase A: the local convergence kernel. It has NO networking, NO relay,
 * NO encryption — those are Phase B concerns. The interface is designed so Phase B
 * can wrap delta export/import with MLS sealing + transport WITHOUT changing this core.
 *
 * Architecture: a LoroDoc is the root; named containers (Text, Map, List) are
 * accessed via getter and mutated directly. Local mutations are STAGED until
 * `commit()` (or an `export*`, which commits implicitly) finalizes them — that is
 * when subscribers fire and the ops become exportable. Imported deltas apply and
 * notify immediately. Snapshots, deltas, and checkpoints are deterministic and
 * replica-independent at convergence.
 */
export class CollabDocument {
  private readonly doc: LoroDoc;

  constructor(snapshot?: Uint8Array) {
    this.doc = new LoroDoc();
    if (snapshot) {
      try {
        this.doc.import(snapshot);
      } catch (error) {
        throw new Error(
          `Failed to import snapshot: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /** Access a named text container. */
  getText(name: string): LoroText {
    return this.doc.getText(name);
  }

  /** Access a named map container. */
  getMap(name: string): LoroMap {
    return this.doc.getMap(name);
  }

  /** Access a named list container. */
  getList(name: string): LoroList {
    return this.doc.getList(name);
  }

  /**
   * Finalize staged local mutations. This fires subscribers and makes the ops
   * exportable. `export*` commits implicitly, so an explicit `commit()` is only
   * needed when you want subscribers to observe local changes before an export.
   */
  commit(): void {
    this.doc.commit();
  }

  /** Return the current converged state as a JSON snapshot (authoritative view for comparing replicas). */
  snapshot(): unknown {
    return this.doc.toJSON();
  }

  /** Export the entire state as a binary snapshot; import into a fresh doc via the constructor or `importDelta`. */
  exportSnapshot(): Uint8Array {
    return this.doc.export({ mode: "snapshot" });
  }

  /**
   * Export changes since a given version. If `from` is omitted, exports all changes
   * (full history as an update). Incremental sync: `other.importDelta(this.exportDeltaSince(other.version()))`.
   * Exporting commits any staged local mutations first.
   */
  exportDeltaSince(from?: CollabVersion): Uint8Array {
    return this.doc.export({ mode: "update", from });
  }

  /**
   * Import a delta (or snapshot) and report status. Fail-closed: malformed bytes
   * return `{ success: false }` rather than throwing. Repeated imports of the same
   * delta are idempotent. `pending` is true when imported ops await missing deps.
   */
  importDelta(bytes: Uint8Array): ImportResult {
    try {
      const status = this.doc.import(bytes);
      return { success: true, pending: (status.pending?.size ?? 0) > 0 };
    } catch {
      return { success: false, pending: false };
    }
  }

  /**
   * Return the current oplog version, used as the `from` argument to `exportDeltaSince`.
   * Two docs that have converged to the same state share the same version.
   */
  version(): CollabVersion {
    return this.doc.oplogVersion();
  }

  /**
   * Subscribe to changes. Fires on `commit()` of local mutations and on `importDelta`.
   * Returns an unsubscribe function.
   */
  subscribe(listener: (event: unknown) => void): () => void {
    return this.doc.subscribe(listener);
  }

  /**
   * Deterministic content hash of the CONVERGED STATE for the append-only checkpoint
   * log. SHA-256 hex over the canonical (RFC 8785 sorted-key) JSON of `snapshot()`.
   * Two converged docs with identical `snapshot()` produce identical `checkpoint()`
   * strings — the basis for `LoroCheckpointRecorded(revision, state_hash)`. Hashing
   * the logical state (not the raw oplog bytes) makes it independent of how each
   * replica reached that state.
   */
  checkpoint(): string {
    const canonical = canonicalJsonBytes(this.snapshot());
    return sha256Digest(canonical);
  }
}

/** Factory to create a CollabDocument, optionally initialized from a binary snapshot. */
export function createCollabDocument(snapshot?: Uint8Array): CollabDocument {
  return new CollabDocument(snapshot);
}
