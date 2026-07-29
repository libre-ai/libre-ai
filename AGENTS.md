# Libre AI Canonical Agent Rules

## Authority

General activation is in force (ADR-0020, 2026-07-28): the target topology is the **current state**, not a deferred one. Two separated authorities own the canon — the `governance` repository (doctrine, invariants, ADRs, LEXICON, ecosystem index, project-card schema, ecosystem tooling, evidence) and the `contracts` repository (canonical contract authorities). **During dismantling, both still live inside this hub** and every path is traced by the migration index (`ecosystem/migration-index.v1.yaml`); a path leaves the hub only after green proof at its destination. This hub ends as an archive plus that index; archiving is pronounced by the owner, never by an agent.

Every product and satellite repository is responsible for its own perimeter now. A project's state (exposure, hypothesis, weighted phase criteria, dated proofs) lives in the `project.v1.yaml` card of its repository, aggregated and verified by `governance` — never declared manually, never duplicated.

Before acting, read `GOALS.md`, `STATUS.md`, `docs/decisions/INVARIANTS.md`, `docs/decisions/DECISION-REGISTER.md` and the activation design (`docs/superpowers/specs/2026-07-28-multi-repo-activation-design.md` — the γ milestone's operating authority). `INVARIANTS.md` is exhaustive by construction: doctrine absent from it does not exist, whatever another document asserts. `ecosystem/FORGOTTEN.yaml` is its counterpart for content (I-23, ADR-0019): what it records has been evicted and is never cited as a live source — and **migrated ≠ forgotten**: the migration index is its functional inverse. `bun run check:forgotten` refuses both resurrection and citation.

## Stack

- Bun fullstack + strict TypeScript + React 19 owns web applications.
- Use `Bun.serve` directly; no Next, Vite, Astro, Hono, Express, Fastify or Elysia.
- Rust owns only specialized engines, WASM, cryptography, authorization, inspection, proof, agent orchestration and system tooling.
- Dioxus is forbidden in the target web stack.
- **One Bun and/or Cargo workspace per repository** (D07 as amended by ADR-0020): each repository owns its lockfiles and its concrete pinned versions. Intra-org dependencies are GitHub git-deps pinned by SHA — a recorded security decision (ADR-0020 §2.5): `[sources.allow-org] github = ["libre-ai"]` in each Rust repo's deny.toml, registry quarantine kept for registry packages. No JavaScript source.

## Boundaries

- Contract authorities are canonical in the `contracts` repository (during dismantling: `contracts/` here).
- Compile-time contract consumers carry byte-exact vendored copies under a drift gate — verified projections (I-05), never hand-edited, never canonical.
- HTTP objects stay in adapters.
- Product migrations and data stay under their application.
- Proof must not depend on private implementation details.
- Never maintain two durable implementations of one domain.

## Naming

- Retired tooling names are never reused as a repository, package or crate (I-04): `agent-factory`, `artifact-supply`, `benchmarks`, `client-kit`, `context-kit`, `design-system`, `dioxus-app-template`, `gear`, `proof-kit`. `website` left this list by nominative regularisation (ADR-0020 §2.4). `docs/transformation/REPOSITORY-MAP.md` holds the historical-to-target mapping; `bun run check:names` enforces it.
- Repository names are never invented: `docs/decisions/LEXICON.md` (signed 2026-07-20, amended 2026-07-28 §8) owns the canonical brick-to-repository map, including the two authority names and the post-signature identifiers. Do not copy that map into another document. Activation state lives in the ecosystem index and the project cards, never in the LEXICON.
- Retired ecosystem brands are denied by the `doctrine-governance` workflow, which owns the exact list — extended by ADR-0020 to newly superseded doctrine statements. Do not copy that list into another document.

## Security

- Validate every external input.
- Browser sessions use opaque HttpOnly cookies plus CSRF.
- Biscuit is the internal deny-by-default authorization mechanism; tenant facts are mandatory.
- Never log secrets, tokens or PII.
- Secrets are runtime-only.
- No US hyperscaler dependency for application runtime or data. GitHub is the accepted code collaboration surface.
- Clever Cloud is deliberately unconfigured until global integration; do not provision it during the γ milestone.
- Local-only applications (`boussole`, `practices`) keep their no-transmission guard wherever their code lives.

## Quality gates

Run affected Bun and Rust checks plus contract and Playwright tests. Uncertain impact expands the test set. Never hide a red test. During dismantling, every path-removal PR adjusts the hub gates it touches in the same PR — the hub stays green while its perimeter shrinks (three bounded red windows are named in the design §5.4, none is silent).

## Agents

- Read actual state before editing.
- Use short branches/worktrees and bounded work packages.
- Stage files before running tree-walking gates (`git ls-files`-based scanners do not see untracked files).
- Never review mutable or uncommitted output in the authoring pass. In solo work, the same agent/session may later perform a dedicated review-only pass on an immutable commit.
- Contracts, auth, migrations, releases, deployments and visibility flips require role-separated technical review under `docs/reviews/AGENT-REVIEW-PROTOCOL.md`; the human owner retains the explicit control milestone.
- γ hard stops are never self-pronounced: creation of the repository batch (class 9), the first product-repo description/unfreeze flip, hub archiving (nominative), a red trunk, autonomy-ceiling breaches (ADR-0011 D6).
- Product-level human decisions explicitly required by a contract remain human.
- Security > quality > performance > completeness.
