# `@libre-ai/contracts`

Disposable TypeScript projections and strict runtime validators for `contracts/schemas/`.

- Canonical authority remains the cataloged JSON Schema files.
- Generated declarations are checked in only to make consumer builds deterministic.
- Runtime validation is mandatory at every untrusted or cross-module boundary; static types do not encode every conditional, format or numeric invariant.
- Validators return `unknown` deliberately: callers cannot select an arbitrary generic type and bypass the distinction between projection and validation.
- Validation errors expose schema/instance paths and keywords only, never input values.

Commands:

In-repo generation and checks:

```sh
bun run generate
bun run generate:check
bun test
```

## Quickstart

```sh
bun add @libre-ai/contracts
```

```ts
import { loadCanonicalContractRegistry } from "@libre-ai/contracts";

const registry = await loadCanonicalContractRegistry();

// validate() returns a result and never throws; assert() throws
// ContractValidationError on failure. Both keep validation mandatory at every
// untrusted boundary — static types alone do not encode every invariant.
// Schema names are the canonical file names (see registry.schemaNames()).
const result = registry.validate(
  "browser-session.v1.schema.json",
  untrustedPayload,
);
if (!result.ok) {
  // result.issues expose schema/instance paths and keywords only — never values.
}
registry.assert("deletion-receipt.v1.schema.json", receipt);
```

## Publication status

**Publish-ready** (`publishConfig.access=public`): the npm `@libre-ai` scope is
reserved (owner, 2026-07-22) and the `private` guard is lifted; publication is
the owner-run `Release satellites` workflow (LEXICON §7.4 — the release itself
stays an owner-gated external action; see
`docs/transformation/WAVE1-PUBLICATION-RUNBOOK.md`). **Bun-first package:** it
ships TypeScript source (no dist build) — consumers need a TS-aware toolchain
(bun natively; vite/esbuild-based bundlers otherwise).
