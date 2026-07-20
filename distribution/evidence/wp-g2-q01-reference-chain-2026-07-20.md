# WP-G2-Q01 reference-chain evidence — 2026-07-20

Foundation reference chain (acceptance criterion 1) run end-to-end from a clean
checkout of `main` after the WP-G2-D01 merge (`43c85e7`), by
`verification/harness/reference-chain.ts`. Evidence is digest-anchored over the
reproducible facts (ordered `id:status`); volatile durations are recorded but
excluded from the digest.

- **Status:** `passed`
- **Reproducible digest:** `fbf566f75491395cbe68de0ead7eafb8e30e2f28a6945f70f2c8a90502515f24`
- **Skipped:** none — the RLS step now exercises the D01 barrier on `main`.

| Step                | Status | Evidence                                                                            |
| ------------------- | ------ | ----------------------------------------------------------------------------------- |
| contracts           | passed | 85 catalog entries, 59 schema-fixture pairs, 113 HTTP operations                    |
| generated-contracts | passed | 60 TypeScript contract projections verified                                         |
| web-react           | passed | Bun.serve + React web-platform tests                                                |
| biscuit             | passed | 16 authorization tests (attenuation, revocation, rotation, fail-closed)             |
| wit                 | passed | 9 WIT worlds parsed via the contract checker                                        |
| proof-artifact      | passed | 17 artifact/evidence-binding tests                                                  |
| secret-scan         | passed | no committed credential markers (acceptance 2)                                      |
| no-clever           | passed | no Clever resource / production claim (acceptance 3)                                |
| rls                 | passed | 35 tenant-isolation tests over 3 files (raw-SQL barrier, adapters, active deletion) |

Not cryptographically signed: signing waits for the provenance brick (wave 2),
consistent with the P3 lineage deferral (no key ceremony authorized,
WP-G2-Z01). The chain reproduces to the same digest on re-run.
