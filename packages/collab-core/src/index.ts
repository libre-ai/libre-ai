/**
 * @libre-ai/collab-core — Phase A CRDT kernel.
 *
 * Crypto-free, transport-free wrapper around Loro CRDT.
 * Exposes CollabDocument for local convergence; Phase B adds encryption + relay.
 */

export { canonicalJson, canonicalJsonBytes, sha256Digest } from "./canonicalization";
export { CollabDocument, createCollabDocument } from "./collab-document";
