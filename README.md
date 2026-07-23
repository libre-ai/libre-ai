**English** · [Français](README.fr.md)

# Libre AI — canonical base repository

**Everything Libre AI builds is built here first.** This monorepo holds the contracts, specifications, doctrine, shared foundations and first product engines of the whole constellation — until each product graduates into its own repository.

New here? The [organization profile](https://github.com/libre-ai) tells the story for humans: what we build, how, and why the method itself is the first product.

## How this repository relates to the rest

The target is one repository per product ([ADR-0008](docs/adr/0008-multi-repo-target-topology-and-brand.md)): each product repository reopens as an independent, interoperable unit consuming this base as a versioned dependency. Until a product is activated by owner decision, its repository stays a public reserved home and all of its work happens here. The authoritative inventory of repositories and exposure states is [`ecosystem/repositories.v1.yaml`](ecosystem/repositories.v1.yaml); the 18 historical repositories are frozen at the SHAs recorded in [`ecosystem/LEGACY-MANIFEST.yaml`](ecosystem/LEGACY-MANIFEST.yaml).

## What's inside

| Path                                              | What lives there                                                                                                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/`](apps)                                   | Product hosts: boussole, missions, model-policy, notebook, practices, radar, sessions, specifications                                                                                   |
| [`packages/`](packages)                           | TypeScript bricks shared by products: web-platform, ui, contracts, data, auth-web, envelope, provenance, classification, knowledge, collab-core, collab-relay, policy-core-ref, testing |
| [`crates/`](crates)                               | Rust engines — deterministic cores where durability and security justify them                                                                                                           |
| [`contracts/`](contracts)                         | The locked interoperability surface: JSON Schemas, OpenAPI, WIT worlds, golden vectors                                                                                                  |
| [`docs/`](docs)                                   | Doctrine: ADRs, product briefs ([`docs/apps/`](docs/apps)), specifications, target architecture, transformation program                                                                 |
| [`ecosystem/`](ecosystem)                         | Machine-readable truth: repository inventory, legacy manifest, portfolio records                                                                                                        |
| [`distribution/evidence/`](distribution/evidence) | Public evidence: gate acceptance log, reports, commitment hashes                                                                                                                        |
| [`prompts/`](prompts)                             | Phase execution prompts for the governed agent workflow                                                                                                                                 |

## Engineering decisions

- Bun `>=1.4.0` fullstack + TypeScript strict + React 19 for the web; CI keeps the exact qualified pin.
- Rust for specialized engines, WASM, security, proof and system tooling.
- One `bun.lock`, one Cargo workspace, one source of contracts.
- Clever Cloud Paris/EU as deployment target.
- Multi-repository target: base + real product repositories built on it ([ADR-0008](docs/adr/0008-multi-repo-target-topology-and-brand.md)); "projection" refers to generated artifacts, never repositories.

## How work is governed

The constellation is built by AI agents under a governed method ([ADR-0009](docs/adr/0009-constellation-portfolio-and-method.md)): bounded plans, evidence at every step, human control gates, documented refusals. What is doctrine — and nothing else — is recorded in [`docs/decisions/INVARIANTS.md`](docs/decisions/INVARIANTS.md); every merge carries a DCO sign-off and green required checks; the public evidence trail lives in [`distribution/evidence/`](distribution/evidence).

## Status

G0–G2 are closed; wave 1 (layer-4 satellites) is opening, sequenced by [`docs/transformation/EXECUTION-SEQUENCING.md`](docs/transformation/EXECUTION-SEQUENCING.md). Live state: [`STATUS.md`](STATUS.md) · goals: [`GOALS.md`](GOALS.md) · roadmap: [`ROADMAP.md`](ROADMAP.md).

## Read in this order

1. [`vision.md`](vision.md) — why a greenfield rebuild, on a 5–10 year horizon
2. [`docs/decisions/DECISION-REGISTER.md`](docs/decisions/DECISION-REGISTER.md) and [`docs/decisions/INVARIANTS.md`](docs/decisions/INVARIANTS.md) — what has been decided, what is doctrine
3. [`GOALS.md`](GOALS.md) and [`STATUS.md`](STATUS.md) — where we are
4. [`docs/architecture/TARGET.md`](docs/architecture/TARGET.md) — the target architecture
5. [`docs/adr/`](docs/adr) — the architecture decision records
6. [`docs/specifications/SPECIFICATION-STANDARD.md`](docs/specifications/SPECIFICATION-STANDARD.md), [`DATA-LIFECYCLE.md`](docs/specifications/DATA-LIFECYCLE.md) and [`IDENTITY-AUTHORIZATION.md`](docs/specifications/IDENTITY-AUTHORIZATION.md) — the cross-cutting specifications
7. [`LICENSING.md`](LICENSING.md), [`TRADEMARKS.md`](TRADEMARKS.md) and [`DATA-PROVENANCE.md`](DATA-PROVENANCE.md) — legal governance

## Contributing

Issues and pull requests for every product happen here — see [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`SECURITY.md`](SECURITY.md). Every commit carries a DCO sign-off.

## License

Differentiated licensing ([ADR-0004](docs/adr/0004-licensing-governance.md)): EUPL-1.2 for first-party software, Apache-2.0 and MIT on designated boundaries, CC BY 4.0 for editorial documentation — see [`LICENSING.md`](LICENSING.md).
