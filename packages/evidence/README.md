# `@libre-ai/evidence`

Bun/TypeScript construction and verification for deterministic Evidence Reports and Artifact
Manifests. Runtime JSON Schema remains authoritative through `@libre-ai/contracts`.

The artifact digest is SHA-256 over canonical JSON for portable ASCII, path-sorted file descriptors. Release
qualification re-hashes supplied file bytes, validates report consistency and requires an exact
passing evidence binding. Results expose only IDs, digests, stable codes and schema paths—never
artifact bytes or hostile values.
