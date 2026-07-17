# Libre AI Canonical Agent Rules

## Authority

This monorepo is the only target architecture and GitHub remains the canonical collaboration surface. Historical sibling repositories are read-only evidence after the global freeze. Do not add compatibility layers unless an accepted external dependency is recorded.

Before acting, read `GOALS.md`, `STATUS.md`, `docs/decisions/DECISION-REGISTER.md` and the prompt for the current phase. Do not work on a later phase while its upstream gate is open.

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
- No US hyperscaler dependency for application runtime or data. GitHub is the accepted code collaboration surface.
- Clever Cloud is deliberately unconfigured until global integration; do not provision it during cleanup/specification.

## Quality gates

Run affected Bun and Rust checks plus contract and Playwright tests. Uncertain impact expands the test set. Never hide a red test.

## Agents

- Read actual state before editing.
- Use short branches/worktrees and bounded work packages.
- Never review mutable or uncommitted output in the authoring pass. In solo work, the same agent/session may later perform a dedicated review-only pass on an immutable commit.
- Contracts, auth, migrations, releases and deployments require role-separated technical review under `docs/reviews/AGENT-REVIEW-PROTOCOL.md`; the human owner retains the explicit control milestone.
- Product-level human decisions explicitly required by a contract remain human.
- Security > quality > performance > completeness.
