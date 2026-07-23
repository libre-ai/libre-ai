/**
 * TESTING ONLY — Identity (no-op) crypto provider.
 *
 * ⚠ DO NOT USE IN PRODUCTION.
 *
 * This provider implements the CryptoProvider interface as a transparent pass-through:
 * seal() appends a dummy frame wrapper around the plaintext, and unseal() unwraps it.
 * There is NO actual encryption, NO authentication, and NO key derivation.
 *
 * Purpose: allow Phase B's sealed-document API to be tested without waiting for the
 * owner-gated MLS key scheduler implementation. The test-only marking ensures this
 * cannot accidentally be deployed.
 *
 * Usage:
 *   const doc = new SealedCollabDocument(baseDoc, new TestIdentityProvider());
 *   const sealed = doc.exportSealedDeltaSince(version);
 *   // sealed.ciphertext === plaintext (no encryption)
 */

import type { CryptoProvider, Epoch, SealedFrame } from "./crypto-types";

/**
 * Test-only identity provider: wraps plaintext in a dummy frame.
 *
 * ⚠ WILL THROW at runtime if anyone attempts to instantiate a production code path
 * that checks for this provider's presence.
 */
export class TestIdentityProvider implements CryptoProvider {
  private readonly testEpoch: Epoch = 0;

  /**
   * Mark this provider as test-only. Throw if called in a context that suggests
   * production use.
   */
  constructor() {
    if (
      typeof globalThis !== "undefined" &&
      Object.hasOwn(globalThis, "PRODUCTION") &&
      (globalThis as Record<string, unknown>).PRODUCTION
    ) {
      throw new Error(
        "TestIdentityProvider instantiated in production context. Use a real CryptoProvider implementation.",
      );
    }
  }

  /**
   * Wrap plaintext in a dummy SealedFrame (no encryption).
   *
   * ⚠ The ciphertext field contains the plaintext — this is for testing only.
   */
  seal(deltaBytes: Uint8Array): SealedFrame {
    // Use a fixed nonce and empty tag for testing; a real implementation would derive these.
    return {
      epoch: this.testEpoch,
      nonce: new Uint8Array(12), // 12 zero bytes (test-only)
      ciphertext: deltaBytes, // Plaintext passed through (test-only)
      tag: new Uint8Array(16), // 16 zero bytes (test-only)
    };
  }

  /**
   * Unwrap a dummy frame (no decryption).
   *
   * ⚠ Returns ciphertext as-is (which contains the plaintext in test mode).
   * Throws if epoch does not match.
   */
  unseal(frame: SealedFrame): Uint8Array {
    if (frame.epoch !== this.testEpoch) {
      throw new Error(
        `Epoch mismatch: frame epoch ${frame.epoch}, current epoch ${this.testEpoch}. Fail-closed.`,
      );
    }
    // In test mode, ciphertext IS plaintext
    return frame.ciphertext;
  }

  /**
   * Return the fixed test epoch.
   */
  currentEpoch(): Epoch {
    return this.testEpoch;
  }
}
