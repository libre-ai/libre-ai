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

Prepared for satellite publication (`publishConfig.access=public`) but **not yet
published**: `private` stays set until the owner reserves the npm `@libre-ai`
scope and authorizes the release (LEXICON §7.4, owner-gated external action).
Until then, consume it as a workspace dependency inside the monorepo.
