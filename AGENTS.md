# Libre AI Canonical Agent Rules

## Authority

This monorepo is the hub: the single authority for contracts, specifications and shared foundations (I-03). GitHub remains the canonical collaboration surface. Historical sibling repositories are read-only evidence after the global freeze. Do not add compatibility layers unless an accepted external dependency is recorded.

The hub is not the final topology. The target is **multi-repository** (I-02): product repositories plus read-only satellite mirrors and distribution repositories, created under fresh thematic names at their activation (ADR-0008 §1). Activation is an owner decision (I-17), never an agent initiative. Until then, everything shared by several products — contracts, identity/authz, data lifecycle, shared UI, proof — stays in the hub (ADR-0008 §5), and a satellite exists as a published package before it ever becomes a repository (I-16).

Before acting, read `GOALS.md`, `STATUS.md`, `docs/decisions/INVARIANTS.md`, `docs/decisions/DECISION-REGISTER.md` and the prompt for the current phase. `INVARIANTS.md` is exhaustive by construction: doctrine that is absent from it does not exist, whatever another document asserts. Do not work on a later phase while its upstream gate is open.

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

## Naming

- Retired tooling names are never reused as a repository, package or crate (ADR-0008 §3): `agent-factory`, `artifact-supply`, `client-kit`, `context-kit`, `design-system`, `dioxus-app-template`, `gear`, `proof-kit`. Their responsibilities live in the hub — `design-system` became `packages/ui`, `client-kit` became `packages/*` plus the Bun template. `docs/transformation/REPOSITORY-MAP.md` holds the full historical-to-target mapping; `bun run check:names` enforces it.
- Satellite and product repository names are already reserved and are never invented: `docs/decisions/LEXICON.md` §2 owns the canonical brick-to-repository map, §1 the historical homes. Do not copy that map into another document. Its wave-1 subset is wired into `tools/release/mirror-satellites.sh`.
- Retired ecosystem brands are denied by the `doctrine-governance` workflow, which owns the exact list. Do not copy that list into another document.

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
