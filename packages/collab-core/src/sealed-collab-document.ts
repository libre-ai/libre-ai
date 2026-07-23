/**
 * @libre-ai/collab-core — Phase B sealed CRDT wrapper.
 *
 * SealedCollabDocument wraps a CollabDocument and a CryptoProvider to seal (encrypt)
 * and unseal (decrypt) deltas. The wrapper is transparent: it does not modify the
 * underlying Phase A CRDT kernel, only intercepts export/import boundaries.
 *
 * Architecture:
 * - exportSealedDeltaSince(version) calls the underlying doc's exportDeltaSince(),
 *   then seals the bytes via the provider.
 * - importSealedDelta(frame) calls the provider's unseal(), then passes the plaintext
 *   to the underlying doc's importDelta().
 * - All other operations (snapshot, commit, subscribe) are delegated unchanged.
 *
 * This design ensures that Phase A's CRDT convergence properties are preserved;
 * the sealing/unsealing is entirely orthogonal to the convergence logic.
 */

import type { CollabDocument, CollabVersion, ImportResult } from "./collab-document";
import type { CryptoProvider, SealedFrame } from "./crypto-types";

/**
 * SealedCollabDocument — transparent crypto wrapper around a CollabDocument.
 *
 * Use this when you need to encrypt deltas in transit (e.g., before sending over
 * an untrusted relay). The underlying doc is unchanged; all modifications pass
 * through the sealing layer at the export/import boundary.
 *
 * Example:
 *   const doc = new SealedCollabDocument(baseDoc, cryptoProvider);
 *   const sealed = doc.exportSealedDeltaSince(version);
 *   // sealed is a SealedFrame ready for relay
 *
 *   // On the other side:
 *   const delta = otherDoc.provider.unseal(sealed);
 *   otherDoc.importDelta(delta); // Phase A import, unchanged
 *
 * IMPORTANT: The underlying doc and provider are not cloned; modifications to
 * the base doc will be reflected in sealed exports.
 */
export class SealedCollabDocument {
  private readonly baseDoc: CollabDocument;
  private readonly provider: CryptoProvider;

  constructor(baseDoc: CollabDocument, provider: CryptoProvider) {
    this.baseDoc = baseDoc;
    this.provider = provider;
  }

  /**
   * Export changes since a given version, sealed under the current epoch.
   *
   * If `from` is omitted, exports all changes (full history as an update).
   * The result is a SealedFrame ready for transport or relay.
   *
   * This is the Phase B equivalent of CollabDocument.exportDeltaSince(), with
   * the addition of sealing.
   *
   * @param from - Optional version marker; if omitted, exports all changes.
   * @returns A SealedFrame containing the encrypted delta.
   */
  exportSealedDeltaSince(from?: CollabVersion): SealedFrame {
    const deltaBytes = this.baseDoc.exportDeltaSince(from);
    return this.provider.seal(deltaBytes);
  }

  /**
   * Import a sealed frame, unseal it, and apply the plaintext delta.
   *
   * Fail-closed: if the provider's unseal() throws (e.g., epoch mismatch or
   * authentication failure), this call propagates the error and does NOT modify
   * the document. The underlying importDelta() is only called if unseal succeeds.
   *
   * @param frame - The SealedFrame to import.
   * @returns The import result from the underlying doc (success, pending).
   * @throws If unseal fails (epoch mismatch, authentication failure, etc.).
   */
  importSealedDelta(frame: SealedFrame): ImportResult {
    // Fail-closed: unseal first, propagate any error before touching the doc.
    const deltaBytes = this.provider.unseal(frame);
    return this.baseDoc.importDelta(deltaBytes);
  }

  /**
   * Delegate to the underlying doc's snapshot() without modification.
   */
  snapshot(): unknown {
    return this.baseDoc.snapshot();
  }

  /**
   * Delegate to the underlying doc's exportSnapshot() without modification.
   */
  exportSnapshot(): Uint8Array {
    return this.baseDoc.exportSnapshot();
  }

  /**
   * Delegate to the underlying doc's importDelta() directly.
   *
   * Use this to import UNSEALED deltas (e.g., received from a relay that has
   * already decrypted them, or during local testing). For sealed frames, use
   * importSealedDelta() instead.
   *
   * @param bytes - Plaintext delta bytes.
   * @returns The import result (success, pending).
   */
  importDelta(bytes: Uint8Array): ImportResult {
    return this.baseDoc.importDelta(bytes);
  }

  /**
   * Delegate to the underlying doc's commit().
   */
  commit(): void {
    this.baseDoc.commit();
  }

  /**
   * Delegate to the underlying doc's version().
   */
  version(): CollabVersion {
    return this.baseDoc.version();
  }

  /**
   * Delegate to the underlying doc's subscribe().
   */
  subscribe(listener: (event: unknown) => void): () => void {
    return this.baseDoc.subscribe(listener);
  }

  /**
   * Delegate to the underlying doc's checkpoint().
   */
  checkpoint(): string {
    return this.baseDoc.checkpoint();
  }

  /**
   * Delegate to the underlying doc's getText().
   */
  getText(name: string): ReturnType<CollabDocument["getText"]> {
    return this.baseDoc.getText(name);
  }

  /**
   * Delegate to the underlying doc's getMap().
   */
  getMap(name: string): ReturnType<CollabDocument["getMap"]> {
    return this.baseDoc.getMap(name);
  }

  /**
   * Delegate to the underlying doc's getList().
   */
  getList(name: string): ReturnType<CollabDocument["getList"]> {
    return this.baseDoc.getList(name);
  }

  /**
   * Return the current epoch of the crypto provider.
   *
   * Useful for debugging or for relay implementations that need to route frames
   * based on epoch.
   */
  currentEpoch(): number {
    return this.provider.currentEpoch();
  }
}
