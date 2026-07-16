# `@libre-ai/contracts`

Disposable TypeScript projections and strict runtime validators for `contracts/schemas/`.

- Canonical authority remains the cataloged JSON Schema files.
- Generated declarations are checked in only to make consumer builds deterministic.
- Runtime validation is mandatory at every untrusted or cross-module boundary; static types do not encode every conditional, format or numeric invariant.
- Validators return `unknown` deliberately: callers cannot select an arbitrary generic type and bypass the distinction between projection and validation.
- Validation errors expose schema/instance paths and keywords only, never input values.

Commands:

```sh
bun run generate
bun run generate:check
bun test
```
