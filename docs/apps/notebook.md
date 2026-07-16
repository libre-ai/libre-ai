# Notebook

- **Path:** `apps/notebook`
- **Owner:** Experiences / Notebook
- **Runtime:** Bun/React PWA with IndexedDB and Web Crypto
- **Tenant model:** personal local-only workspace in v1, accepted by ADR-0002

## Purpose and actors

Notebook is a private local-first block notebook that lets its owner select exactly which blocks and links enter a portable context export. The device owner is the only v1 actor; external consumers receive explicit immutable exports, never direct notebook access.

## Journeys

1. **Capture offline:** owner creates/edits linked blocks with local durable revisions and can search without network.
2. **Prepare context:** owner selects blocks, sees recursively required links/assets and explicit exclusions, then previews the exact serialized export.
3. **Share/revoke locally:** owner exports a content-addressed file, records that local export event and can mark it superseded without pretending to erase copies already shared.
4. **Backup/restore/delete:** owner produces encrypted backup, restores into a new local workspace with deterministic conflict report, or destroys workspace keys/data.

## Non-goals

- implicit ingestion, background cloud sync or server-side note storage in v1 ;
- RAG chat over the complete notebook ;
- collaborative editing, public publishing or hidden telemetry ;
- claiming remote revocation of a downloaded export ;
- transmitting blocks to build an index.

## Domain protocol

**Commands:** `CreateWorkspace`, `CreateBlock`, `EditBlock`, `LinkBlocks`, `DeleteBlock`, `SelectContext`, `ExcludeContextBlock`, `CreateContextExport`, `MarkExportSuperseded`, `CreateEncryptedBackup`, `RestoreBackup`, `DeleteWorkspace`.

**Queries:** `GetBlock`, `SearchLocalIndex`, `GetBacklinks`, `PreviewContextExport`, `ListLocalExports`, `ValidateBackup`.

**Events:** `BlockCreated`, `BlockRevised`, `BlockLinked`, `BlockDeleted`, `ContextSelectionChanged`, `ContextExportCreated`, `ExportSuperseded`, `BackupCreated`, `BackupRestored`, `WorkspaceDeleted`.

Blocks use immutable revision records plus current head. Restore never silently overwrites: equal IDs with divergent content produce explicit conflict entries and require a new revision choice.

## Refusal matrix

| Code | Refusal |
| --- | --- |
| `notebook.workspace_locked` | key unavailable or unlock refused |
| `notebook.revision_stale` | edit targets a non-current block revision |
| `notebook.export_dependency_missing` | selected graph references missing required block |
| `notebook.export_exclusion_conflict` | excluded block is required by selected contract |
| `notebook.export_preview_mismatch` | serialized export hash differs from preview hash |
| `notebook.backup_authentication_failed` | backup AEAD verification fails |
| `notebook.restore_version_unsupported` | backup contract version has no explicit adapter |
| `notebook.remote_sync_forbidden` | v1 request attempts server note persistence |

Failure never uploads data or drops the previous valid local revision.

## Data

IndexedDB owns encrypted block revisions, links, local index, export metadata and settings. L'inventaire local distingue contenu chiffré, clés, index et métadonnées d'exports ; chacun est supprimé lors de `DeleteWorkspace`, tandis qu'une copie exportée hors de l'application reste sous le contrôle explicite de l'utilisateur et ne peut pas être révoquée à distance. Workspace content encryption uses a non-exportable device key where available; portable backup uses `libre-ai.recovery-secret-code.v1` (16 local CSPRNG bytes displayed as 32 lowercase hex characters) by default, with memory-hard KDF parameters encoded in the envelope; any separately approved text-secret mode applies `libre-ai.recovery-secret-text.v1` exactly. Retention is until explicit local deletion. Delete removes records and keys; browser/storage limitations are disclosed. No historical notebook database is migrated automatically; v1 migration input is only validated portable export/backup.

## Authentication and authorization

No server account or session is required in local-only v1. Workspace unlock is local authentication, not authorization for another service. Context exports contain no Biscuit. A future consumer imports the export under its own authorization boundary. If a native wrapper adds biometric unlock, it only releases the local key and does not create identity claims.

## Runtime boundaries

TypeScript owns block graph, UI, IndexedDB, local index, export selection and generation of fresh opaque 128-bit backup/context IDs plus fresh salt/nonce bytes. Any product timestamp belongs inside the encrypted plaintext and never in the clear envelope. Notebook Core v2 is a candidate Rust/WASM boundary for canonical context bytes and Argon2id/AES-256-GCM sealing/opening; this amendment implements no engine. Promotion requires independent cryptography and privacy review. The future component imports no host capability. No native FFI or server service is allowed in v1; sensitive bytes cross transiently, DOM and IndexedDB handles do not.

## Accessibility and degraded mode

All core journeys work offline and keyboard-only. Editor announces formatting/state without trapping focus; graph has a list/table equivalent. Export preview is readable text with included/excluded counts and warnings. Storage quota or key failure blocks mutation with export/recovery guidance and preserves previous data.

## Contracts

- Notebook Backup v2 — `contracts/schemas/notebook-backup.v2.schema.json` ;
- Backup Seal Request v2 — `contracts/schemas/notebook-backup-seal-request.v2.schema.json` ;
- Context Document v2 — `contracts/schemas/context-document.v2.schema.json` ;
- canonicalization/backup crypto candidate — `contracts/wit/notebook-core-v2/world.wit` and `SEMANTICS.md` ;
- public test vectors — `contracts/fixtures/notebook-core-v2/golden-vectors.v1.json`.

No OpenAPI contract exists for v1 local data.

## Evidence

Unit tests cover graph closure, exclusions, revisions, canonical hashes and conflicts. Contract vectors cover corrupt ciphertext, unknown KDF, missing dependencies and old versions. Browser tests cover offline reload, quota errors, export/import/delete and keyboard/screen reader. Security review proves no content network requests and no plaintext persistence/logging. Cross-browser backup vectors must round-trip.

## Work packages

1. backup/context contracts and crypto vectors — Canonical Core ;
2. local block/revision/index domain — Experiences ;
3. audited canonicalization and backup crypto WASM — Specialized Rust ;
4. PWA offline/storage/accessibility shell — Web Platform ;
5. restore/delete/privacy/browser qualification — Infrastructure and Release.

The Rust boundary remains justified because memory-hard Argon2id is not supplied by browser Web Crypto, but implementation is NO-GO until an independent cryptographer reproduces the vectors and validates browser budgets, AAD, anti-oracle behavior and zeroization. Golden vectors and zeroized transient key material remain release gates.

## Release and rollback

Release requires offline create/edit/search, exact preview/export, encrypted backup/restore, conflict and deletion proof across supported browsers. Application rollback must continue reading current stored contract; a release that writes a new storage major cannot ship without a backward reader and export-first rollback plan. No rollback may resurrect a deleted key or workspace.
