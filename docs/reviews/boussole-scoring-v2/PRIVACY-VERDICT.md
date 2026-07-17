# Revue privacy — Boussole v2

Attribution: `reviewPassId=boussole-v2-7ad0695-privacy`, `reviewerAgentId=pi-boussole-privacy-gpt54mini`, `reviewerSessionId=71cce63b-da03-409a-bdee-8f3e8afa311b`, `provider=openai-codex`, `model=gpt-5.4-mini`  
Commit revu: `7ad0695b563745d2c6223f4d2cdcafc9fd9e3d0a`

## Hashes recomputés

| Autorité | SHA-256 |
| --- | --- |
| `contracts/catalog.v1.json` | `a2ae197a889bcdac65622a4928f85cfe6b8cf93ddaf0c4fcc862c68e982f7de8` |
| `contracts/schemas/public-vote-dataset.v2.schema.json` | `1cbd6b677be4204c6d497390b424adcc5720cad177caa776040eb10c17f1ebdb` |
| `contracts/schemas/boussole-method.v2.schema.json` | `2595aa22dd994882a5694bf49b350e6fd8a03fbd725416a0a393c97372abd893` |
| `contracts/schemas/boussole-response-set.v2.schema.json` | `f321841591dc534e0760a98d90688e3f396c64f4f52e0400f06f05a811018b1e` |
| `contracts/schemas/local-comparison.v2.schema.json` | `1b85bf05268124fb40dc2e06c4c780741bc46927f3048ccaa4fac6a203ef741b` |
| `contracts/fixtures/boussole-scoring-v2/golden-vectors.v1.json` | `404fb3a87d9863698b7ccc4aea767be902530b2cc295a2c9ffd3fa251769fd97` |
| `contracts/fixtures/boussole-scoring-v2/security-vectors.v1.json` | `14d954762d90db04f8029079dd7da9b99fdfbf45358ff1d4208a8938f3a7ad98` |
| `contracts/wit/boussole-scoring-v2/SEMANTICS.md` | `da3043afba7642b8a1d77633ccecf7c1fbe45c71448f936cef566b738ad0ff8a` |
| `contracts/wit/boussole-scoring-v2/world.wit` | `75b6a8c1b565e8b64ddd590b1ddc7a86f7b22d827cbdbc4e3a0e599dfce223ad` |
| `docs/apps/boussole.md` | `c40703bee74a1b782c9178c48b8c2027872fb1d8ca71362c36d3006bc66d2da3` |
| `docs/reviews/boussole-scoring-v2/README.md` | `e734ac53c0dfd8cbb9e8f23ce81b57d318f5188980633b046b67e40a788bf666` |
| `tools/quality/check-boussole-v2-vectors.ts` | `cf973bbc3793f7eaaef9ceba01fec93fd0e467615b42cd91ff39e8b36320d7a6` |

## Evidence

- `bun tools/quality/check-boussole-v2-vectors.ts` ✅
  - 10 cas méthodologiques
  - 8 refus raw
  - 8 bornes de ressources
  - 9 refus sémantiques
  - 1 cas arithmétique maximal
- `rg` sur les autorités Boussole ✅
  - pas d’IDs utilisateur/répondant réels
  - seulement des IDs opaques `rev_*`
  - pas de PII réelle
- `world.wit` ✅
  - export unique
  - zéro import
  - pas de capacité réseau / stockage / compte
- Schémas + docs ✅
  - set de réponses local et comparison local sans ID utilisateur ni réponse individuelle brute
  - publication agrégée avec `minimumGroupSize >= 5`
  - exclusion des petits groupes
  - champs d’identité prohibés
  - attestations HTTPS hashées, à consentement explicite
  - approbations méthode/dataset distinctes
  - scoring public `candidate` / release-disabled

## Findings

- Aucun bloquant.
- Aucun écart privacy observable sur le périmètre immuable revu.

## Residual

- Les attestations externes restent vérifiées contractuellement, pas résolues par le composant pur.
- Ce pass ne couvre pas une implémentation runtime inexistante ; il valide les contrats/vecteurs immuables seulement.

PRIVACY APPROVE
