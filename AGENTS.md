# Libre AI Canonical Agent Rules

## Authority

This monorepo is the only target architecture. Historical sibling repositories are read-only evidence after the global freeze. Do not add compatibility layers unless an accepted external dependency is recorded.

## Stack

- Bun fullstack + strict TypeScript + React 19 owns web applications.
- Use `Bun.serve` directly; no Next, Vite, Astro, Hono, Express, Fastify or Elysia.
- Rust owns only specialized engines, WASM, cryptography, authorization, inspection, proof, agent orchestration and system tooling.
- Dioxus is forbidden in the target web stack.
- One `bun.lock`, one Cargo workspace, no JavaScript source.

## Boundaries

- Contracts are canonical under `contracts/`.
- HTTP objects stay in adapters.
- Product migrations and data stay under their application.
- Proof must not depend on private implementation details.
- Never maintain two durable implementations of one domain.

## Security

- Validate every external input.
- Browser sessions use opaque HttpOnly cookies plus CSRF.
- Biscuit is the internal deny-by-default authorization mechanism; tenant facts are mandatory.
- Never log secrets, tokens or PII.
- Secrets are runtime-only.
- No US hyperscaler dependency.

## Quality gates

Run affected Bun and Rust checks plus contract and Playwright tests. Uncertain impact expands the test set. Never hide a red test.

## Agents

- Read actual state before editing.
- Use short branches/worktrees and bounded work packages.
- Do not approve your own output.
- Human approval is required for contracts, auth, migrations, releases and deployments.
- Security > quality > performance > completeness.
