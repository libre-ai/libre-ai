# Boussole scoring v2 — Architecture review record

- **reviewPassId:** `boussole-v2-7ad0695-architecture`
- **reviewerAgentId:** `pi-boussole-architecture-gpt54`
- **reviewerSessionId:** `b1d21823-ae59-493a-a7a0-0c8ddea2f460`
- **provider / model:** `openai-codex / gpt-5.4`
- **role:** `architecture`
- **mode:** dedicated read-only review pass under `docs/reviews/AGENT-REVIEW-PROTOCOL.md`
- **reviewed commit:** `7ad0695b563745d2c6223f4d2cdcafc9fd9e3d0a`

No reviewed authority was modified during this pass. This record is **not** a promotion record and grants **no** public scoring or implementation authorization.

## Reviewed authorities and hashes

| Authority | SHA-256 |
| --- | --- |
| `contracts/catalog.v1.json` | `a2ae197a889bcdac65622a4928f85cfe6b8cf93ddaf0c4fcc862c68e982f7de8` |
| `contracts/fixtures/boussole-scoring-v2/golden-vectors.v1.json` | `404fb3a87d9863698b7ccc4aea767be902530b2cc295a2c9ffd3fa251769fd97` |
| `contracts/fixtures/boussole-scoring-v2/security-vectors.v1.json` | `14d954762d90db04f8029079dd7da9b99fdfbf45358ff1d4208a8938f3a7ad98` |
| `contracts/schemas/public-vote-dataset.v2.schema.json` | `1cbd6b677be4204c6d497390b424adcc5720cad177caa776040eb10c17f1ebdb` |
| `contracts/schemas/boussole-method.v2.schema.json` | `2595aa22dd994882a5694bf49b350e6fd8a03fbd725416a0a393c97372abd893` |
| `contracts/schemas/boussole-response-set.v2.schema.json` | `f321841591dc534e0760a98d90688e3f396c64f4f52e0400f06f05a811018b1e` |
| `contracts/schemas/local-comparison.v2.schema.json` | `1b85bf05268124fb40dc2e06c4c780741bc46927f3048ccaa4fac6a203ef741b` |
| `contracts/wit/boussole-scoring-v2/SEMANTICS.md` | `da3043afba7642b8a1d77633ccecf7c1fbe45c71448f936cef566b738ad0ff8a` |
| `contracts/wit/boussole-scoring-v2/world.wit` | `75b6a8c1b565e8b64ddd590b1ddc7a86f7b22d827cbdbc4e3a0e599dfce223ad` |

## Commands and evidence

- `git rev-parse HEAD` → `7ad0695b563745d2c6223f4d2cdcafc9fd9e3d0a`
- `shasum -a 256 ...` on catalog, 2 vector corpora, 4 schemas, `SEMANTICS.md`, `world.wit` → hashes above
- `bun tools/quality/check-boussole-v2-vectors.ts` → passed: `10 methodology cases, 8 raw refusals, 8 resource boundaries, 9 semantic refusals, 1 generated maximum-arithmetic case; public scoring still candidate-only`
- `cargo test -p libre-ai-ecosystem-engine --test wit_contracts --locked -- --nocapture` → passed; source test enforces resolved `world.imports.is_empty()` and exactly one exported interface
- `cargo test -p libre-ai-contract-types --test schema_fixtures --locked -- --nocapture` → passed; both-direction schema fixture validation and fail-closed checks
- Independent Python read-only pass → confirmed:
  - catalog binds `golden-vectors` + `security-vectors`
  - 10 golden cases inventory intact
  - all 8 closed refusal codes covered
  - success-case dataset/method/response digests recompute from the declared JCS hash domains
  - reviewer attestation, opaque `rev_*` IDs, kind-specific URNs, publication policy, and arithmetic maxima are coherent
- `git rev-list --count HEAD -- <Boussole v1 authorities>` → each count `1`; v1 baseline remains unchanged in repo history
- `find crates -maxdepth 2 -type d | rg 'boussole'` and `find apps -maxdepth 2 -type d | rg 'boussole'` → no Boussole engine/app implementation present

## Findings

### Blocking
- None.

### Major
- None.

### Minor
- None.

## Architecture assessment

- **Catalog binding:** `contracts/catalog.v1.json` binds the Boussole WIT authority to both normative corpora and keeps all five Boussole v2 authorities in `candidate` with required roles `architecture/security/methodology/privacy`.
- **WIT boundary:** `contracts/wit/boussole-scoring-v2/world.wit` exposes one `api`, zero resolved imports, one `compare` function, and a closed 8-code refusal enum.
- **Schema/SEMANTICS coherence:** the 4 schemas plus `SEMANTICS.md` align on:
  - kind-specific URNs (`urn:libre-ai:dataset:*`, `urn:libre-ai:method:*`)
  - hash-bound method/dataset/response-set digests
  - opaque reviewer IDs plus HTTPS attestation digests
  - publication policy with `minimumGroupSize >= 5`, exclusion of small groups, no identity exposure, expiry
  - deterministic `normalized-agreement-v2` with exact rational arithmetic and decimal-6 half-even rounding
  - bounded arrays, strings, counters, outputs, and wide-intermediate arithmetic beyond `u64`
- **Vector coverage:** golden + security vectors cover interface success paths, duplicate/unknown references, duplicate reviewer rejection, raw decoding refusals, resource ceilings, semantic refusals, redaction canaries, and maximum arithmetic.
- **Compatibility:** ADR-0003 + `contracts/COMPATIBILITY.md` keep Boussole v1 unchanged and non-reinterpreted; no v1→v2 adapter is introduced.
- **No engine/capability:** no Boussole engine crate/app exists; no network/storage/clock/randomness/identity capability is introduced by the reviewed authorities.

## Residual risks

- This pass is **architecture-only**: no promotion, no public scoring, no implementation authorization.
- Any non-architecture verdict must be bound to these exact hashes on `7ad0695b563745d2c6223f4d2cdcafc9fd9e3d0a` before promotion.
- Some invariants remain semantic/vector-enforced rather than JSON-Schema-expressible; implementation conformance still requires later runtime evidence.

## Explicit verdict

ARCHITECTURE APPROVE
