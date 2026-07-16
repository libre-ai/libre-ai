# `libre-ai-artifact`

Deterministic, content-addressed Artifact Manifest construction and verification.

The artifact digest is SHA-256 over canonical JSON for strictly sorted portable ASCII file paths.
Every descriptor is derived from supplied bytes; manifest bytes never grant authority over source
contracts or file contents. Build and release manifests require an Evidence Report reference, but
only `libre-ai-proof` can qualify that reference as passing and correctly bound.
