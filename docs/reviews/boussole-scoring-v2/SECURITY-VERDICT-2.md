# Boussole scoring v2 — Security review pass

- `reviewPassId`: `boussole-v2-7ad0695-security`
- `reviewerAgentId`: `pi-boussole-security-gpt55`
- `reviewerSessionId`: `a8f70436-8877-4c01-8f32-03aa9c44d9c1`
- `provider/model`: `openai-codex` / `gpt-5.5`
- Role: `security`
- Mode: independent read-only role-specific pass
- Reviewed immutable commit: `7ad0695b563745d2c6223f4d2cdcafc9fd9e3d0a`
- Scope: Boussole v2 contracts, WIT, semantics, fixtures, security vectors, review dossier.

No reviewed file was modified.

## Hash table

| Path | SHA-256 |
| --- | --- |
| `contracts/schemas/common.v1.schema.json` | `2b96e658dc88c8118fcd3720d6b9b30c445debd1a4facbfe43b321b610a1a396` |
| `contracts/schemas/boussole-method.v2.schema.json` | `2595aa22dd994882a5694bf49b350e6fd8a03fbd725416a0a393c97372abd893` |
| `contracts/schemas/public-vote-dataset.v2.schema.json` | `1cbd6b677be4204c6d497390b424adcc5720cad177caa776040eb10c17f1ebdb` |
| `contracts/schemas/boussole-response-set.v2.schema.json` | `f321841591dc534e0760a98d90688e3f396c64f4f52e0400f06f05a811018b1e` |
| `contracts/schemas/local-comparison.v2.schema.json` | `1b85bf05268124fb40dc2e06c4c780741bc46927f3048ccaa4fac6a203ef741b` |
| `contracts/schemas/engine-golden-vectors.v1.schema.json` | `cf1a61a5f0e6c9d5c35a869adfa2a3d464c2550f28572735934e02a884cec463` |
| `contracts/fixtures/boussole-scoring-v2/golden-vectors.v1.json` | `404fb3a87d9863698b7ccc4aea767be902530b2cc295a2c9ffd3fa251769fd97` |
| `contracts/fixtures/boussole-scoring-v2/security-vectors.v1.json` | `14d954762d90db04f8029079dd7da9b99fdfbf45358ff1d4208a8938f3a7ad98` |
| `contracts/wit/boussole-scoring-v2/world.wit` | `75b6a8c1b565e8b64ddd590b1ddc7a86f7b22d827cbdbc4e3a0e599dfce223ad` |
| `contracts/wit/boussole-scoring-v2/SEMANTICS.md` | `da3043afba7642b8a1d77633ccecf7c1fbe45c71448f936cef566b738ad0ff8a` |
| `tools/quality/check-boussole-v2-vectors.ts` | `cf973bbc3793f7eaaef9ceba01fec93fd0e467615b42cd91ff39e8b36320d7a6` |
| `tools/quality/check-contracts.ts` | `ae722425aa33f36163ae3796ea80913909fda3c8773c281f770e31fec6b896cf` |
| `docs/reviews/boussole-scoring-v2/README.md` | `e734ac53c0dfd8cbb9e8f23ce81b57d318f5188980633b046b67e40a788bf666` |
| `docs/reviews/boussole-scoring-v2/SECURITY-REMEDIATION.md` | `2cae4bbad3b82ab5d1e584fb5e87f0c630732e03da6486ca648826f1a066d0b0` |

## Evidence executed

- `git rev-parse HEAD` → exact target commit.
- `git status --short` → no tracked change.
- `sha256sum ...` → hashes above.
- `bun tools/quality/check-boussole-v2-vectors.ts` → passed: 10 methodology cases, 8 raw refusals, 8 resource boundaries, 9 semantic refusals, 1 generated maximum-arithmetic case.
- `bun tools/quality/check-contracts.ts` → passed: 71 catalog entries, 47 schema fixture pairs, 103 HTTP operations.
- `cargo test -p libre-ai-ecosystem-engine --test wit_contracts --locked` → passed; candidate WIT worlds resolve, including import-free Boussole v2.
- Independent Python recomputation:
  - strict UTF-8/BOM/duplicate-key fixture loading;
  - canonical method/dataset/response digests;
  - exact rational scoring and half-even rounding;
  - closed refusal inventory;
  - raw security vector hashes;
  - exact/+1 byte limits;
  - maximum arithmetic `21474836475000000000` above `u64::MAX` and within signed 128-bit;
  - catalog candidate/vector binding.

## Findings

Blocking: none.

Major: none.

Minor: none.

Clean security axes confirmed:

- WIT v2 boundary exports one API and resolves with zero imports.
- Error surface is static and non-reflective: closed `refusal-code` only.
- Raw byte vectors cover BOM, invalid UTF-8, duplicate JSON members, malformed JSON, invalid number, unpaired surrogate, unknown field and max depth.
- All eight closed refusal codes are covered.
- Resource limits cover exact and `+1` for dataset, method, responses and successful output.
- Kind-specific method/dataset URNs and digest bindings are enforced by schemas and vectors.
- Duplicate reviewer, statement, response and reference/digest mismatch cases fail closed.
- Publication threshold floor, expiry and aggregate-only identity policy are represented and checked.
- Reviewer IDs are opaque `rev_*`; attestations are HTTPS/hash/consent-bound.
- Local comparison output does not include reviewer IDs, source text or raw local response values.

## Residual risks / boundary

- No Boussole Rust/WASM product engine exists yet; runtime memory, fuel/timeout, panic/trap behavior and built-component import scanning remain future implementation evidence.
- Browser zero-transmission, IndexedDB/local deletion/export and network interception are outside this contract-only pass.
- Real attestation resolution, professional-capacity verification and consent validation remain release-caller responsibilities.
- Methodology and France/EU privacy roles remain separate review authorities; this pass does not promote, implement or release anything.

SECURITY APPROVE
