# `@libre-ai/web-platform`

Framework-free Bun/React web boundary. It provides deterministic React document rendering,
hydration, strict local-asset validation, security headers, static assets and a small request
router for direct `Bun.serve` adapters.

Bun request objects remain in the server adapter. The package has no product domain, storage,
authentication or infrastructure responsibility.

## Publication

**Publish-ready** (`publishConfig.access=public`) as a wave-1 support satellite:
`@libre-ai/auth-web` consumes `secureResponse` (response-hardening surface —
duplicating it would drift), so this package joins the publish set by
dependency closure even though EXECUTION-SEQUENCING names only ui/auth/sdk-ts;
owner-vetoable. `react`/`react-dom` are peer dependencies. **Bun-first
package:** it ships TypeScript source (no dist build) — consumers need a
TS-aware toolchain (bun natively; vite/esbuild-based bundlers otherwise).
Publication is the owner-run `Release satellites` workflow (see
`docs/transformation/WAVE1-PUBLICATION-RUNBOOK.md`). No reserved mirror
repository yet: npm-only until the owner reserves one.
