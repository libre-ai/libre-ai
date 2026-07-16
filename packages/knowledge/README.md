# `@libre-ai/knowledge`

Read-only TypeScript consumer for the deterministic public Knowledge Object projection.

The JSON Schemas and source objects under `ecosystem/` remain authoritative. Graph ingestion,
trust transitions and projection generation belong to `libre-ai-ecosystem-engine`; this package
only validates the generated projection, verifies its SHA-256 selection digest and exposes stable
queries.

It performs no network access, imports no Git history and never promotes draft or untrusted input.
