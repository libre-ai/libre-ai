# Specifications

- **Path:** `apps/specifications`
- **Purpose:** turn intent into explicit decisions, contracts and acceptance criteria.
- **Runtime:** Bun/React.
- **Owns:** workspaces, decisions, SpecPackage authoring, validation and planning-only handoff.
- **Does not own:** execution or orchestration.
- **Rust candidate:** package hashing only if cross-runtime determinism requires it.
- **Critical gates:** incomplete specs refused, approvals attributable, immutable accepted packages and handoffs granting no execution right.
