# Hub archive — agent rules

This repository is the dismantled hub of the Libre AI reconstruction,
kept as an archive (ADR-0020, general activation). It is no longer a
canonical source of anything except its own history and the two machine
registers below. Archiving is pronounced by the owner, never by an agent.

## Authorities (all external now)

- Doctrine, invariants, ADRs, LEXICON, ecosystem index, fleet tooling:
  the `governance` repository.
- Canonical contracts and vectors: the `contracts` repository.
- Project state: the `project.v1.yaml` card of each repository,
  aggregated by the governance fleet gates.

## What this archive still owns

- `ecosystem/migration-index.v1.yaml` — the migration map: destination,
  first carrying commit, last verified-green commit, and removal commit
  for every path that lived here. `history-only` entries and the
  forgetting register's `recoverable_at` anchors resolve against this
  repository's history.
- `ecosystem/FORGOTTEN.yaml` — evicted content (I-23): recoverable at
  the recorded commits, never citable as a living source.
- `ecosystem/cards/libre-ai.project.v1.yaml` — this repository's own
  state card, read by the governance fleet-presentation gate.
- Accepted evidence in the git history (gates, reviews, toolchain
  provenance) — immutable; its living projection is published by
  `governance`.

## Rules for touching the archive

- Read the actual state before editing; run the remaining chain
  (`bun run check`) and keep it green — the archive stays verifiable.
- Never resurrect a migrated or forgotten path here: fix it at its
  destination. The migration index only ever gains removal commits.
- History is never rewritten: no force push, no history edits, no
  deletion of evidence.
- Commits are signed off (DCO); merges are squash with the trailer in
  the merge message.
