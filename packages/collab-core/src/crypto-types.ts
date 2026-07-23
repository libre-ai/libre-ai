/**
 * @libre-ai/collab-core — Phase B crypto seam types.
 *
 * Defines the `CryptoProvider` interface and sealed frame types for MLS-based
 * encryption of delta exports. The seam allows Phase B to wrap Phase A's
 * exportDeltaSince/importDelta without changing the CRDT core.
 *
 * IMPORTANT: The actual MLS encryption algorithm lives in a separate, owner-gated
 * implementation. This package provides ONLY the interface and test-only identity
 * provider (clearly marked, unsuitable for production).
 */

/**
 * An opaque epoch identifier, used to bind sealed frames to a specific encryption
 * generation. Two replicas that agree on epoch can decrypt each other's frames.
 *
 * Epochs advance when the MLS group is updated (members added, removed, or keys
 * rotated). Within an epoch, all frames use the same symmetric key.
 */
export type Epoch = number;

/**
 * A sealed (encrypted) frame containing a single delta or snapshot.
 *
 * The sealer commits to the epoch, epoch key, and plaintext; the receiver verifies
 * the epoch matches their current generation before unsealing.
 *
 * - `epoch`: identifies the encryption key generation
 * - `nonce`: random IV for AEAD (XOR-resistant against IV reuse within an epoch)
 * - `ciphertext`: encrypted delta bytes
 * - `tag`: AEAD authentication tag (verifies ciphertext integrity and authenticity)
 */
export interface SealedFrame {
  readonly epoch: Epoch;
  readonly nonce: Uint8Array;
  readonly ciphertext: Uint8Array;
  readonly tag: Uint8Array;
}

/**
 * CryptoProvider — interface for sealing and unsealing CRDT deltas.
 *
 * An implementation holds an MLS key scheduler and epoch state. On each call,
 * it derives the current epoch key and seals/unseals frames deterministically.
 *
 * Implementations MUST:
 * - Seal: produce a well-formed SealedFrame with a fresh nonce and correct tag.
 * - Unseal: return the plaintext if the tag is valid and epoch matches current;
 *   throw if verification fails (fail-closed).
 * - NEVER produce a seal with a zero nonce or empty key.
 * - NEVER log plaintext or keys.
 * - NEVER expose the epoch key directly.
 */
export interface CryptoProvider {
  /**
   * Seal a delta (or snapshot) under the current epoch.
   *
   * @param deltaBytes - The plaintext CRDT delta to encrypt.
   * @returns A SealedFrame ready for relay or transport.
   * @throws If the provider is in an invalid state (e.g., no key loaded).
   */
  seal(deltaBytes: Uint8Array): SealedFrame;

  /**
   * Unseal a frame if it matches the current epoch and passes authentication.
   *
   * @param frame - The sealed frame to decrypt.
   * @returns The plaintext delta bytes if verification succeeds.
   * @throws If the epoch does not match, the tag is invalid, or decryption fails.
   *         Fail-closed: never silently returns corrupted data.
   */
  unseal(frame: SealedFrame): Uint8Array;

  /**
   * Return the current epoch. Replicas that differ in epoch cannot decrypt each
   * other's frames (a safety property).
   */
  currentEpoch(): Epoch;
}
