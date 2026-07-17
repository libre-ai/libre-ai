# Architecture verdict — d37f047

- Verdict: `APPROVE architecture`
- Immutable target: `d37f04729cc91249c22f98d7f072ce0f268c116f`
- Review pass: `engine-envelope-d37-architecture`
- Session: `019f7018-1a9b-72f4-bbf2-5a09add97fe3`
- Provider/model: `openai-codex/gpt-5.4` (`xhigh`)
- Raw reviewer-output SHA-256: `dfe4b931b27e7206eed49f4b20c3a315930191c91b8bb8bf1744e1a6437429ee`
- Effect: retained as immutable audit evidence; any subsequent scanner change makes approval evidence stale

## Verbatim reviewer output

Rapport de rôle — Architecture, pass review-only

- **Cible immuable** : `d37f04729cc91249c22f98d7f072ce0f268c116f`
- **Arbre Git** : `57fd1ef945aee7a63431e5e42809e385698b0081`
- **Parents du merge final** : `6459c19a3cf3b716bdd6628e6acd27186d5b7951` / `2325445c896c7cc701210856416db035223760d4`
- **Base inspectée** : `d0c25bcd3988242ac097d02613bf5608669cd50e`
- **Immutabilité** : `git status --short` vide avant/après ; HEAD exact confirmé
- **Toolchain qualifié** : `bun --revision` = `1.4.0-canary.1+57f349f63` ; `bun run check:toolchain` vert

## Historique effectif inspecté

Chaîne utile revue depuis `d0c25bc` : `0311d98 → 12e5b73 → 3ec2f2e → 9f15ae8 → ae455b9 → 2eae7ba → 2ccb05c → 3baecf8 → 39f776e → e6df443 → 9e74bab → ded4d6b → 1523bcd → 453b0a6 → 86109d8 → 2325445 → d37f047`.

Constat merge final :
- `2325445..d37f047` : **diff vide** ; HEAD a exactement l’arbre du parent branche
- `6459c19..d37f047` : **7 fichiers** seulement, tous sur la surface specialized-engine
- patch SHA-256 surface candidate `d0c25bc..HEAD` : `9afff28b9050236dcbb845ee419583667dc1aa37bc6b3dcffc6a081739b2168a`
- patch SHA-256 `6459c19..HEAD` : `f492473eda8fdfa92cae71929696f2b902b85c2177e020e9edbb07807d9dd324`

## Inventaire candidat

- `contracts/catalog.v1.json` : **1 seul candidat**
- unique entrée candidate : `engine-golden-vectors-v1`
- hash catalogue : `9623562702488b3cd1d3bf5b0d266acb7e4c3ebc204995e55797b3a4356f2a35`

## Hashes revérifiés

### Autorité partagée
- `contracts/schemas/engine-golden-vectors.v1.schema.json` `2300274b0ee626ccc01eb3d42142f1dd4bef96aaf8c4c68c0569188caec5954b`
- `contracts/fixtures/schema-fixtures.v1.json` `fe1f1a274747a2f7393cb4763e23d71d913bf0be883add6cde2d4501af9d7d28`
- `packages/contracts/src/generated/engine-golden-vectors.v1.d.ts` `47f952ac16bd5c5ac26192cb0da0d5a77bf93c6f412b89801e5d4337ec275816`
- `packages/contracts/src/generated/manifest.json` `c1def40a03fdb9fafe34c4185249334eee6ffa8fbc6933cfa91932bfa02129da`
- `tools/quality/check-contracts.ts` `1c421b1e047ffd2e96012fb000b62d67160f61f2c78fbe4b7ac3deefee06f9f4`

### Corpora
- Radar golden `1e8c0f446b254d6b2a15ee68cee8b4485f9fdbe73d38f894bf3464e32ab11365`
- Radar security `a092dabcd81afdac4eaeb57aafc4bf9c26cec89aa514f05e48e56bfe1b0804a6`
- Notebook golden `734eeecefd5c4b70fa1b86f3c389259117087882d2e105ec14dfabae5062ee09`
- Policy v1 golden `e13033f2bcf7f790557088018b6453a81232e0b019e1d4089624a3cbab92c3e4`
- Policy v1 operators `6e1abd2c8806c982019a5cfa573d156f0f5be4fd9b11dd188a97e9bfbbebc298`
- Policy v2 golden `cbb5023c4a0c31a47d983aed2ad0d0c67309e9da5a8d7833fe7f53f224a98aad`
- Policy v2 operators `cb4c4d1929e01cfc6cd87d5f4386e54b9f3294ef6789c562f556d1b0c5db5bc2`
- Policy v2 budgets `6f7ed86b5c84c9d29588d871908251370038dcabe90ebc646f2a9c1b620d8f77`
- Invalid-json manifest `15fc871a4347303c8abf3dad6810c0532d8546b514e3c4a9b4fc81f6c5e4d378`
- Boussole golden `f5ac9c7a052b5c7cd3524be5a3d323b5fb65d2fc4cce361c1fed8e12f4204335`
- Boussole security `267b7144e5c97fd8840dc40c0c87933000696547a959bbd246904e3af53fc8b6`

### Dossier specialized-engine
- `README.md` `2c89ac4622ee77369660df9aca88cbcff79a02cdc1d01b5934b073e40d7a168c`
- `REMEDIATION.md` `af6d41196d599581655d21712c5c2d69d86dd660b2ce7d619bd2b3e7987651ed`
- stale `ARCHITECTURE-VERDICT.md` `42d02e057731676871ee01dbe64ca6772b8bb8837e6aa490d045f17b40e32ad1`
- stale `SECURITY-VERDICT.md` `03c24677664bfcf2b150e9bdf07cc6d1b3a6cd7970a7031efc44f5530add4728`
- stale `ARCHITECTURE-VERDICT-FINAL.md` `0833f3f2c390c6ca031e47226f1414746b9f7595af98362a3fc5f7164c404a5f`
- stale `SECURITY-VERDICT-FINAL.md` `eddde521d25b35b1f32385ca40a2ea93cbeedb39aebe5bc18e42ff982191f158`
- `ARCHITECTURE-VERDICT-79D02.md` `74725a31d7a3323d32f3b17a5e84a90fd5497fd352edc493b981f1e551ec6a42`
- `SECURITY-VERDICT-79D02.md` `442fc6009a56c930143e2704fdddf2a4a37f0f1e24bb5ee95d08708bdcd6bc13`
- `CANDIDATE-INTEGRATION-79D02.md` `bd2b9af3136ba6b124e9dfbeeddee67af75c3735529730008f5116bdda2b253a`
- rejects :
  - `AE455` `18c2e8d32892d44546398f18e448316ab01e4791e52f03022aa9c32feb81773b`
  - `3BAECF8` `9dd66f60242f395313553b82eb7e936aa07c633d4f39ad5aebc492aa4c308dbb`
  - `39F776E` `6e9dc13e5f11d57a75df483c57cd38b623ea429db4511c43bb4d9bfef5eda84d`
  - `E6DF443` `59607db595d156db37723e1bbe47130db2b9c0a9263055a958a4925b4f487967`
  - `9E74BAB` `e27011a3f008bac8518e7cce83641530a05cb346cd6df3e1081e8aa8383b8432`
  - `A4E74A6` `b55a0e87af9841dcc2081091c00aa277c342b817e798be60a20e14d416b9e2bc`
  - `453B0A6` `116a09b818bc33a8cc37b649a74040f9d35ebe3d14c010212e0d6f28c3813c58`

## Checks rejoués

- `bun run check:toolchain` ✅
- `bun run check:contracts` ✅  
  `Contracts verified: 71 catalog entries, 47 schema fixture pairs, 103 HTTP operations`
- `bun tools/quality/check-radar-v2-vectors.ts` ✅
- `bun tools/quality/check-notebook-v2-vectors.ts` ✅
- `bun tools/quality/check-policy-core-vectors.ts` ✅
- `bun tools/quality/check-policy-core-v2-vectors.ts` ✅
- `bun tools/quality/check-boussole-v2-vectors.ts` ✅
- `bun run check:generated-contracts` ✅  
  `Verified 48 TypeScript contract projections`
- `bun run check:notebook-core-v2` ✅
- `cargo test -p libre-ai-contract-types --test schema_fixtures --locked` ✅
- `cargo test -p libre-ai-ecosystem-engine --test wit_contracts --locked` ✅

## Probe indépendante

J’ai rejoué la logique de détection actuelle sur des chaînes ciblées et validé le schéma courant :

- **rejetés comme sensibles** :  
  `alice@example.org`, `%40`, `&commat;...&period;...`, chaînes mixtes `amp/numeric/named`, local-part quoted (`"alice"@example.org` + encodages), domaines literals IPv4/IPv6, domaines Unicode, fullwidth `＠`, default-ignorable, `sk_live_...`
- **préservés / représentables** :  
  `R&D`, `R&amplitude`, `release@2`, `"release"@2`, `policy &#fragment and %not-encoding`, `https://example.org/a%2Fb`, `Café démonstration`, `../../secrets.txt`, `file:///etc/passwd`, `&alpha;`, `&at;`, `alice&commat.example&period;org`
- **schéma** :
  - payload opaque avec ces chaînes ✅
  - `reproductionEvidence.contact = alice@example.org` ❌
  - `contractFiles.path = contracts/../secrets.txt` ❌

## Findings

Aucun finding bloquant architecture.

Constats positifs :
- **Responsabilité metadata vs payload** : séparation nette `metadataValue` / `payloadValue`; les chaînes métier restent moteur-propriétaires.
- **Enveloppe structurelle et bornes** : 8 MiB avant parse, JSON UTF-8 strict, profondeur 64, 200 000 nœuds, 65 536 code points, 4 096 items, 512 propriétés.
- **`contractFiles`** : seule surface résolue/exécutable ; chemins `contracts/...`, hash SHA-256, anti-traversal/symlink/escape.
- **Scanner** : garde de publication/privacy explicite, pas sémantique métier ; appliqué avant AJV, erreurs génériques, canary Radar strictement valeur+fichier.
- **Syntaxe email / normalisation HTML** : couverture effective dot-atom, quoted local-part, domaines DNS/punycode/literals, `%`, `%u`, références numériques HTML, aliases nommés requis avec `;`, seul wrapper legacy `&amp` imbriqué conservé.
- **Préservation des inconnus/littéraux** : confirmée pour `R&D`, `R&amplitude`, `%`/`&#` littéraux, URLs, Unicode, path/file canaries inertes.
- **Opacité générée** : `engine-golden-vectors.v1.d.ts` reste volontairement opaque (`unknown` récursif) ; recherche repo : pas de consommateur runtime/produit de `LibreAiSpecializedEngineGoldenVectorIndexV1`.
- **Enrollment futur** : pas d’onboarding implicite ; l’autorité reste `candidate`, `internal`, et tout futur consommateur doit rester lié au catalogue + checker dédié + revue séparée.
- **Governance** : le dossier conserve toutes les approbations stale et tous les rejets ; `README.md`/`STATUS.md` invalident explicitement `ae455b9` et `79d02b6`.

## Residual risks

- L’enveloppe partagée reste **structurelle**, pas auto-suffisante pour de futurs moteurs : il faut conserver l’autorité sémantique dans les checkers/WIT propres à chaque moteur.
- Les anciens verdicts stale restent en arbre pour audit ; ils sont correctement invalidés, mais un reviewer futur ne devra jamais les citer isolément.
- Cette passe ne prouve ni conformité runtime d’un moteur, ni scoring public, ni données réelles, ni capability, ni release, ni infra, ni déploiement.

## Portée explicitement non autorisée

Cette revue n’autorise pas :
- moteur produit TS/Rust ;
- scoring public ;
- traitement de données réelles/personnelles/tenant ;
- capability réseau/stockage/secrets/clock/randomness ;
- release, infrastructure, Clever Cloud, déploiement ;
- promotion `candidate -> locked` sans passe Security séparée et jalon owner.

APPROVE architecture — enveloppe bornée, séparation metadata/payload correcte, garde de publication explicite, régressions email/HTML closes sous Bun qualifié, sans expansion d’autorité
