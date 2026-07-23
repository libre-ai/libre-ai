/**
 * @libre-ai/collab-core — Phase A CRDT kernel + Phase B crypto seam.
 *
 * Phase A: Crypto-free, transport-free wrapper around Loro CRDT.
 * Exposes CollabDocument for local convergence.
 *
 * Phase B: Crypto seam (CryptoProvider interface, SealedCollabDocument wrapper).
 * Provides transparent sealing/unsealing of deltas without changing the Phase A core.
 * Includes a test-only identity provider; real crypto is owner-gated.
 */

export { canonicalJson, canonicalJsonBytes, sha256Digest } from "./canonicalization";
export { CollabDocument, createCollabDocument } from "./collab-document";
export type { CryptoProvider, Epoch, SealedFrame } from "./crypto-types";
export { SealedCollabDocument } from "./sealed-collab-document";
export { TestIdentityProvider } from "./test-identity-provider";
