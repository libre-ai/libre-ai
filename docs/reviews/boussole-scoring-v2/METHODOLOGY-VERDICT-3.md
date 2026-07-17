# Boussole scoring v2 — methodology review

## Attribution

- **Review pass:** `boussole-v2-7ad0695-methodology`
- **Role:** Methodology
- **Mode:** Independent read-only role-specific pass
- **Commit:** `7ad0695b563745d2c6223f4d2cdcafc9fd9e3d0a`
- **Agent:** `pi-boussole-methodology-gpt56luna`
- **Session:** `4064e838-6c19-415d-9de3-0ee4140197ff`
- **Provider/model:** `openai-codex / gpt-5.6-luna`

No files were modified. Worktree remained clean.

## Scope

Reviewed only formula, scale normalization, abstention/missing treatment, weighting, denominator and omission accounting, statement matching/order, rounding, publication floor boundary, semantic vectors and digests.

Architecture, security, privacy and promotion were not reviewed. Public scoring remains **NO-GO**.

## Authority SHA-256

| Authority | SHA-256 |
|---|---|
| `contracts/catalog.v1.json` | `a2ae197a889bcdac65622a4928f85cfe6b8cf93ddaf0c4fcc862c68e982f7de8` |
| `contracts/fixtures/boussole-scoring-v2/golden-vectors.v1.json` | `404fb3a87d9863698b7ccc4aea767be902530b2cc295a2c9ffd3fa251769fd97` |
| `contracts/fixtures/boussole-scoring-v2/security-vectors.v1.json` | `14d954762d90db04f8029079dd7da9b99fdfbf45358ff1d4208a8938f3a7ad98` |
| `contracts/schemas/boussole-method.v2.schema.json` | `2595aa22dd994882a5694bf49b350e6fd8a03fbd725416a0a393c97372abd893` |
| `contracts/schemas/public-vote-dataset.v2.schema.json` | `1cbd6b677be4204c6d497390b424adcc5720cad177caa776040eb10c17f1ebdb` |
| `contracts/schemas/boussole-response-set.v2.schema.json` | `f321841591dc534e0760a98d90688e3f396c64f4f52e0400f06f05a811018b1e` |
| `contracts/schemas/local-comparison.v2.schema.json` | `1b85bf05268124fb40dc2e06c4c780741bc46927f3048ccaa4fac6a203ef741b` |
| `contracts/wit/boussole-scoring-v2/SEMANTICS.md` | `da3043afba7642b8a1d77633ccecf7c1fbe45c71448f936cef566b738ad0ff8a` |
| `contracts/wit/boussole-scoring-v2/world.wit` | `75b6a8c1b565e8b64ddd590b1ddc7a86f7b22d827cbdbc4e3a0e599dfce223ad` |
| `tools/quality/check-boussole-v2-vectors.ts` | `cf973bbc3793f7eaaef9ceba01fec93fd0e467615b42cd91ff39e8b36320d7a6` |

## Independent evidence

A separate Python 3 implementation used RFC 8785-compatible canonicalization for the fixture domain, exact `Fraction` arithmetic, and `ROUND_HALF_EVEN`. It did not import or invoke the TypeScript checker.

All ten methodology vectors matched.

| Case | Independent result |
|---|---|
| `excluded-abstentions-positive-agreement` | `0.333333`, denominator `15`, omitted `3` |
| `reject-duplicate-reviewer` | `approval-invalid` |
| `reject-zero-denominator` | `denominator-zero` |
| `neutral-scale-five` | `0.250000`, denominator `20`, omitted `2` |
| `weighted-with-skipped-and-missing` | `-0.500000`, denominator `40`, omitted `22` |
| `half-even-boundaries` | score `0.000001`; contributions `0`, `0.000002` |
| `reject-unknown-statement` | `response-invalid` |
| `zero-answer-is-not-skip` | score `0`, denominator `15`, omitted `3` |
| `intermediate-scale-normalization` | `2/5 × 5/15 = 0.133333` |
| `negative-half-even-boundaries` | score `-0.000001`; contributions `0`, `-0.000002` |

Verified:

- exact `r/M`, including zero and negative values;
- public-position difference `(votesFor - votesAgainst)`;
- excluded versus neutral abstentions;
- skipped/missing omission accounting;
- weighted global numerator and denominator;
- zero-denominator refusal;
- response/reference matching and statement-ID ordering;
- six-decimal positive and negative ties-to-even;
- negative-zero normalization.

Maximum arithmetic independently matched:

- considered: `12,884,901,885,000`;
- omitted: `17,179,869,180,000`;
- weighted numerator: `21,474,836,475,000`;
- score denominator: `64,424,509,425,000`;
- scaled numerator: `21,474,836,475,000,000,000`, above unsigned 64-bit and within signed 128-bit.

## Publication boundary

The floor is correctly declared as `minimumGroupSize >= 5`.

The semantics consistently treat small groups as **excluded before publication**. The scorer rejects a dataset containing an under-floor statement rather than including it in denominator or omission totals. The new threshold mutation has group size `18`, raises the floor to `19`, independently recomputes dataset digest `22b45f26f1f42f48bdd0df2676b05e98cbe7a27ab5bea764ccc18fed6cd6a2bb`, and returns `input-invalid`.

Expiry is also consistent: `computedAt` strictly after `publicationReviewExpiresAt` returns `approval-invalid`.

The checker passed all nine semantic refusal cases, including digest mismatch, unsupported scale, invalid Gregorian date, duplicate references, threshold, expiry and redaction canaries.

## Verification commands

- `bun tools/quality/check-boussole-v2-vectors.ts` — passed: 10 methodology, 8 raw, 8 resource, 9 semantic, maximum arithmetic.
- `bun tools/quality/check-contracts.ts` — passed.
- `cargo test -p libre-ai-ecosystem-engine --test wit_contracts --locked` — passed.
- `bun run --cwd packages/contracts generate:check` — environment-blocked because `node_modules/.bin/biome` is absent; no repository mutation or methodology finding.

## Findings

- Blocking: none.
- Major: none.
- Minor/non-blocking: none within the methodology scope.

## Residuals

- Real-dataset wording, representativeness, source selection and licence evidence remain editorial/release responsibilities.
- Runtime engine conformance and implementation resource behavior remain outside this role.
- Catalog status must remain candidate; public scoring remains disabled pending the other role verdicts, promotion pass and human control milestone.

METHODOLOGY APPROVE
