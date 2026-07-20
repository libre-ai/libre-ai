# `libre-ai-artifact`

Canonical G2 Artifact candidate verification for `WP-G2-P01`.

## Scope

The crate validates `artifact-manifest.v1` and `evidence-report.v1` through the embedded canonical contract registry, verifies candidate bytes in memory, and returns a content-addressed result only when every binding passes.

It owns no filesystem, registry, network, signing key, publication workflow, release approval or artifact storage. Artifact bytes never become authority over source contracts. No historical supply-chain tooling name or contract is imported (the retired repositories are recorded in `ecosystem/LEGACY-MANIFEST.yaml`).

## Content digest

The v1 artifact content digest is SHA-256 over RFC 8785 JCS bytes for the array of file descriptors sorted by `path`. Each descriptor contains exactly:

```json
{ "path": "…", "size": 0, "digest": "…", "mediaType": "…" }
```

Each file digest is SHA-256 over its exact bytes. Sorting makes input and manifest array order non-authoritative. Candidate paths must be portable relative ASCII paths: duplicate paths, drive/absolute forms, backslashes, control characters and empty, `.` or `..` segments fail closed.

An Evidence Report reference digest is SHA-256 over the RFC 8785 JCS representation of the complete report. For `build` and `release` manifests, verification requires:

- a schema-valid Evidence Report with overall `pass` status;
- all checks passing, as enforced by the canonical schema;
- exact evidence ID, digest and `application/json` media type binding;
- evidence subject equal to the manifest ID;
- evidence subject digest equal to the verified artifact content digest.

This creates candidates only. It does not authorize a public release, production, infrastructure or deployment.

## Refusals

Public refusal values expose stable codes such as:

- `artifact.manifest-schema-invalid`;
- `artifact.path-duplicate`;
- `artifact.file-digest-mismatch`;
- `artifact.manifest-digest-mismatch`;
- `artifact.evidence-required`;
- `artifact.evidence-not-passing`;
- `artifact.evidence-subject-mismatch`.

No refusal includes artifact bytes, hostile paths or rejected document values.

## Verification

```console
cargo test --locked -p libre-ai-artifact
cargo clippy --locked -p libre-ai-artifact --all-targets --all-features -- -D warnings
```
