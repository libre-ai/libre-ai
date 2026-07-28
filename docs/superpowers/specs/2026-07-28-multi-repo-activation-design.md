# Design — Activation générale multi-repo et refonte de présentation

- **Date :** 2026-07-28 (révision 2, même jour)
- **Statut :** validé sur le fond par le propriétaire en session (les quatre décisions §2) ; ce document en est la forme écrite. La révision 1 (`b7bf336`) a été soumise à deux passes K4 indépendantes (cohérence doctrinale, faisabilité d'exécution) qui l'ont rejetée pour des défauts de forme — invariants non amendés, supersessions non bornées, topologie non confrontée à l'inventaire, mécanique de dépendances incompatible avec les manifestes réels. Cette révision intègre l'intégralité des findings ; les décisions §2 sont inchangées et ne sont pas re-questionnées.
- **Portée :** l'organisation GitHub `libre-ai` entière — le hub `libre-ai/libre-ai`, les repos gelés/réservés existants, les repos à créer, et toute la présentation publique (README org, page d'accueil, README/description/roadmap par repo, fiches structurées, comparaisons).

## 1. Contexte et état constaté (2026-07-28)

- G0–G2 sont fermés ; la doctrine en vigueur (ADR-0008/0009/0011/0018) prévoit une activation **par vagues** des satellites, chaque activation étant une décision propriétaire (I-17), un satellite existant d'abord comme package publié (I-16). ADR-0018 (2026-07-25) a ouvert la vague 3 et placé les spécifications d'orchestration sous `docs/apps` (son D3).
- Le hub porte tout le contenu réel : 14 packages TypeScript, 7 crates Rust, 8 applications réelles (code + tests + e2e), 88 autorités de contrats (`contracts/catalog.v1.json`), la doctrine, l'index d'écosystème, l'outillage. Les décomptes exacts sont dérivés de l'inventaire et de l'arbre — jamais gravés (I-14).
- Côté GitHub : 13 repos — le hub, 7 homes produits `[Frozen]`, `website`/`carriere` `[Reserved]`, `missions` `[Frozen]`, `db-inspect` (outil actif), `.github` (profil org).
- **Dérives factuelles relevées** (à corriger par cette mission) :
  - `STATUS.md` est en retard sur le code (le crate `policy-core` existe, les packages `envelope`/`provenance` sont nés) ;
  - le LEXICON, signé le 2026-07-20, ignore les identifiants nés après sa signature : les packages `testing`, `data`, `rgpd-kit`, `classification`, `collab-core`, `collab-relay`, `policy-core-ref` et le crate `policy-core` (sa phrase « les six crates du workspace » est périmée : il y en a sept) ;
  - **I-04 est périmé au registre depuis le 2026-07-23** : l'amendement propriétaire d'ADR-0008 a levé la préservation systématique des URLs historiques (premier cas : `agent-board` → `missions`, repo GitHub déjà renommé, inventaire déjà aligné), mais le texte d'I-04 dans `INVARIANTS.md` n'a jamais été rattrapé ;
  - le repo `website` a été **créé et activé de facto sans acte propriétaire** : 7 PRs mergées dans un repo `[Reserved]`, alors que le LEXICON §1.2 range `website` dans les noms retirés (I-04), qu'ADR-0008 pt 3 dit « ne sont pas recréés », que son pt 4/I-05 interdit un repo de projection, que ses Conséquences placent le site en `apps/website` (qui n'existe plus dans l'arbre), et que I-17 réserve les activations au propriétaire. L'inventaire l'a réconcilié le 2026-07-23 en constat d'observable, sans amendement d'ADR. L'acte doctrinal §3 régularise nominativement cette situation.
- Les moteurs produits (Radar, Policy, Boussole…) ne sont pas implémentés ; seul Notebook Core a sa Gate B. Les apps existent, les moteurs non.

## 2. Décisions propriétaire de session (2026-07-28)

Quatre décisions prises explicitement par le propriétaire en session, que l'ADR §3 enregistrera formellement :

| #   | Question                                       | Décision                                                                                                   |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| D1  | Portée de « terminer la migration multi-repo » | **Activation générale** : acte doctrinal, chaque repo devient responsable de son périmètre dès maintenant  |
| D2  | Responsabilité résiduelle du hub               | **Démantelé à terme** : le hub devient archive + index de migration                                        |
| D3  | Porteur des autorités après démantèlement      | **Deux autorités séparées** : repo `governance` (doctrine) + repo `contracts` (contrats canoniques)        |
| D4  | Séquencement de la migration physique          | **Migration intégrale en une vague** : fichiers ET code, workspaces éclatés, hub archivé en fin de mission |

Recommandations intégrées acceptées avec le design :

- **un repo par package/crate pour les satellites de code partagé** (pas de regroupement) — la règle est scopée aux satellites §4.3 : les repos produits §4.2 regroupent délibérément app + crates produit + specs (`notebook` + `notebook-core`, `policy` + `policy-core` + `policy-core-ref`) ;
- **dépendances inter-repos par git-deps GitHub** (commits épinglés dans `bun.lock`/`Cargo.lock`) — reste dans l'exception US déjà acceptée (GitHub, code public), zéro création de compte ; la publication npm/crates.io devient une étape de distribution ultérieure, checkpoint propriétaire. La mécanique concrète et ses implications de sécurité, qui font partie de la décision, sont spécifiées en §5.2 et enregistrées à l'ADR comme **décision de sécurité**, pas comme détail d'outillage.

## 3. Acte doctrinal (préalable à tout)

Un nouvel ADR « Activation générale et démantèlement du hub » qui :

1. **supersède, de manière bornée** :
   - ADR-0009 **§8 (ordre de migration en vagues) et, dans son §4, la seule loi de couverture** (brique → package publié → repository vivant, churn mesuré bas, exploitation couverte par l'automatisation prouvée, métriques publiées comme précondition, clause de clôture « une large constellation est un niveau à débloquer, jamais un état de départ »). **Les §1, 2, 3, 5, 6, 7 et 9 d'ADR-0009, et la loi d'exposition du §4, restent en vigueur** : les invariants I-13, I-14, I-15, I-17, I-18, I-19 et I-20 conservent leur source d'arbitrage intacte ;
   - ADR-0011 pour sa partie séquencement (D1 vagues 4a/4b) ; ses politiques de gate (D3 arrêt dur du lock orchestrateur, D4 confiance graduée, D6 plafonds) restent en vigueur ;
   - ADR-0018 pour son cadre de vagues ; ses work-packages couche 2 deviennent la roadmap du repo `orchestrator`, et son D3 (foyer de spécification `docs/apps` sous Specification Lock) est remplacé par la ventilation §4 — le gate `check-specification-lock` migre vers `governance` en version cross-repo, ou est retiré avec trace à l'index de migration ;
   - ADR-0008 §5 (« tout le partagé reste au socle ») et ADR-0008 pt 3 pour le seul cas `website` (régularisation nominative, point 4 ci-dessous) ;
2. **amende les invariants** — chaque amendement est porté au registre par la même PR :
   - **I-02** : la cible multi-repository devient l'état courant, pas une cible différée ;
   - **I-03** : « aucune seconde autorité » est remplacé par **deux autorités séparées** — `governance` (doctrine, invariants, ADR, LEXICON, index d'écosystème, schéma des fiches, outillage d'écosystème, evidence) et `contracts` (autorités canoniques de contrats) ; la règle « un sujet = une autorité unique » demeure, la carte d'autorité (`docs/README.md`) est réécrite en conséquence ;
   - **I-04** : réécrit pour intégrer l'amendement propriétaire du 2026-07-23 (les noms conformes à l'architecture priment sur la préservation des URLs) — les noms d'outillage retirés restent morts, `website` excepté par régularisation (point 4) ;
   - **I-05** : « projection ≠ repository » est conservé pour les artefacts générés ; l'ADR précise que les **copies vendorées de contrats sous gate de dérive** (§5.2.3) sont des projections vérifiées au sens d'I-05 — jamais éditées à la main, jamais canoniques ;
   - **I-16** : les quatre conditions de la loi de couverture (package publié d'abord, churn bas, exploitation couverte prouvée, métriques publiées) et sa clause de clôture sont **abrogées comme préconditions d'existence d'un repo** ; les métriques de couverture restent des indicateurs publiés a posteriori ;
   - **I-23** : inchangé, mais l'ADR énonce la frontière **migré ≠ oublié** : l'index de migration est l'inverse fonctionnel de `FORGOTTEN.yaml` (le contenu migré a une destination vivante, le contenu oublié n'en a pas) ; `check:forgotten` ne doit jamais traiter un chemin migré comme évincé ; les `recoverable_at` du registre d'oubli restent résolubles dans l'archive clonable du hub, et le registre migré vers `governance` emporte une note de résolution (« SHA dans l'archive `libre-ai/libre-ai` ») — le garde-fou de `governance` vérifie contre l'archive, pas contre son propre historique ;
3. **enregistre D1–D4** comme décisions propriétaire datées, et la mécanique git-deps comme **décision de sécurité** (§5.2.5 : ce qu'elle désarme, ce qui la borne) ;
4. **régularise nominativement l'activation du repo `website`** au titre d'I-17 : le prompt de mission γ (acte propriétaire) lui assigne la page d'accueil et les comparaisons ; l'ADR enregistre la création et l'activation de fait, corrige sa description GitHub, et lève la contradiction avec LEXICON §1.2/ADR-0008 pt 3 pour ce seul nom. La signature propriétaire de l'ADR (merge = signature, arrêt dur) est l'acte qui régularise ;
5. **amende le LEXICON** (même procédure que sa signature : production → revue K4 → arrêt dur → merge = signature). Ce n'est pas une simple extension, c'est un **amendement de fond** :
   - noms d'autorité nouveaux : `governance`, `contracts` — avec désambiguïsation explicite : le repo `libre-ai/contracts` (autorités canoniques) et le package `@libre-ai/contracts` (SDK TypeScript, repo `sdk-ts`, nom conservé par le LEXICON §2.1) sont deux objets distincts ;
   - noms des identifiants nés après la carte : packages `testing`, `data`, `rgpd-kit`, `classification`, `collab-core`, `collab-relay`, `policy-core-ref` (rejoint le repo produit `policy`, pas un satellite) et crate `policy-core` (idem) ; la phrase « six crates » du §2 est corrigée ;
   - **renversement assumé du §2.5** : `knowledge`, `web-platform`, `authz-biscuit` et `ecosystem-engine`, rangés « sans exposition satellite prévue » ou « internes au socle jusqu'à promotion I-16 », deviennent des repos satellites — cohérent avec l'abrogation des préconditions d'I-16 (point 2) ;
   - régularisation `agent-board` → `missions` : la carte rattrape l'arbitrage propriétaire du 2026-07-23 (ADR-0008 amendé) — c'est la documentation qui avait dérivé, pas GitHub ;
   - sort des six noms réservés non instanciés : `proof`, `memory`, `harness`, `mcp-server`, `corpus`, `docs` **restent réservés, aucun repo créé dans γ** ; `harness` et `memory` sont re-scopés comme roadmap du repo `orchestrator` (contenu ADR-0018/WP-G3-H01) ;
   - péremption des colonnes « Activation / vague » des tables §1.1 et §2.1–2.4, remplacées par un renvoi à l'index d'écosystème ;
6. **institue l'index de migration** : chaque chemin du hub → sa destination (repo + SHA du premier commit), vérifiable par un gate machine (diff `git ls-files` du hub ↔ index : échec sur orphelin) ; le hub passe en état « démantèlement en cours » puis « archivé » en fin de mission ;
7. **met à jour les autorités documentaires que l'acte périme** — pas seulement `AGENTS.md`, `GOALS.md`, `STATUS.md`, `ROADMAP.md`, mais aussi : `docs/README.md` (carte d'autorité — deux autorités, index de migration), `docs/architecture/TARGET.md` (architecture cible), `docs/transformation/EXECUTION-SEQUENCING.md` (séquencement supersédé), `docs/transformation/REPOSITORY-MAP.md` (carte historique → cible), `ecosystem/repositories.v1.yaml` (~34 entrées à terme), `vision.md` (sections topologie), `docs/decisions/DECISION-REGISTER.md` (entrée nouvelle). `AGENTS.md` cesse de déclarer le hub « the single authority » et sa liste de noms retirés est alignée sur LEXICON §1.2 (cas `website`/`benchmarks` tranché par le point 4). L'ADR documente enfin la **dépendance d'autorité amont hors organisation** : I-08 est co-sourcé par le control-plane ADR 0047 (`constantin-jais/constantin-jais`) — `governance` l'enregistre comme dépendance documentée.

## 4. Topologie cible (~34 repos, dérivée de l'inventaire)

La topologie ci-dessous est **reconstruite depuis `ecosystem/repositories.v1.yaml`** (I-14 : l'inventaire fait foi) et l'arbre réel. Le décompte (~34) est indicatif, jamais normatif : 1 hub archivé + 2 autorités + 8 produits + 1 application couche 2 + 19 satellites + `website` + `db-inspect` + `.github`.

### 4.1 Autorités (2 repos à créer)

| Repo         | Périmètre                                                                                                                                                         | Reçoit du hub                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `governance` | doctrine, décisions, invariants, LEXICON, index écosystème, schéma des fiches projet, agrégateur d'avancement, outillage d'écosystème, evidence, gates cross-repo | `docs/decisions`, `docs/adr`, `docs/method`, `docs/transformation`, `docs/reviews`, `docs/security`, `docs/positioning`, `docs/parity`, `docs/rfcs`, `docs/architecture`, `docs/specifications` (les cinq locks G1 transverses), `docs/README.md`, `docs/toolchain`, `docs/superpowers`, `GOALS.md`, `STATUS.md`, `ROADMAP.md`, `vision.md`, `ecosystem/`, `tools/`, `verification/`, `prompts/`, `distribution/` (hors templates), `toolchains/` (+ re-hébergement de l'asset de release du toolchain Bun, §5.4.3) |
| `contracts`  | les 88 autorités canoniques, catalog, compatibilité, gates contrats                                                                                               | `contracts/`, `docs/API-STABILITY.md`, `COMPATIBILITY`                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### 4.2 Produits (8 produits couche 1) et application couche 2

L'inventaire ratifie **8 produits couche 1** (décision propriétaire du 2026-07-23 pour `carriere`). `missions` n'est **pas** un produit : c'est l'application de la couche 2 (LEXICON §1.1, ADR-0009 §2) — elle garde son repo, migre dans la même vague, classée à part.

| Repo                 | Reçoit du hub                                                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notebook`           | `apps/notebook`, `crates/notebook-core`, `docs/apps/notebook.md`, `docs/apps/notebook-resource-floor.md`, `third_party/rustcrypto-aes-0.8.4` + `PATCH.md` + `.cargo/config.toml` (§5.2.4)                                  |
| `feed-radar`         | `apps/radar`, `docs/apps/radar.md`                                                                                                                                                                                         |
| `boussole-politique` | `apps/boussole`, `docs/apps/boussole.md`                                                                                                                                                                                   |
| `policy`             | `apps/model-policy`, `crates/policy-core`, `packages/policy-core-ref`, `docs/apps/model-policy.md`                                                                                                                         |
| `ai-practices`       | `apps/practices`, `docs/apps/practices.md`                                                                                                                                                                                 |
| `sessions`           | `apps/sessions`, `docs/apps/sessions.md`                                                                                                                                                                                   |
| `spec-studio`        | `apps/specifications`, `docs/apps/specifications.md` — correspondance **confirmée** par l'inventaire (`canonical_paths: [apps/specifications]`), le manifeste (`@libre-ai/specifications`) et le contrat `spec-package.v1` |
| `carriere`           | fiche `project.v1.yaml` seulement — 8ᵉ produit ratifié, aucun code au hub                                                                                                                                                  |
| `missions` (app L2)  | `apps/missions`, `docs/apps/missions.md` + `docs/apps/agent-board.md` (doublon fusionné par la régularisation §3.5)                                                                                                        |

Ventilation du reste de `docs/apps` : `harness.md`, `memory.md`, `orchestrator.md` → repo `orchestrator` (briques couche 2, ADR-0018 D3) ; `website.md` → repo `website`. `docs/specifications/` ne contient **aucune** spec d'app : ses cinq locks G1 transverses (DATA-LIFECYCLE, IDENTITY-AUTHORIZATION, LOOP-SECURITY-KERNEL, SPECIFICATION-STANDARD, DECISION-QUEUE) vont à `governance`.

### 4.3 Satellites code partagé (19 repos à créer)

| Repo           | Source hub                                                                                                                                                                                             |     | Repo               | Source hub                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ------------------ | ------------------------- |
| `ui`           | `packages/ui` + histoire `packages/design-system` (§5.1)                                                                                                                                               |     | `authz-biscuit`    | `crates/authz-biscuit`    |
| `auth`         | `packages/auth-web`                                                                                                                                                                                    |     | `ecosystem-engine` | `crates/ecosystem-engine` |
| `sdk-ts`       | `packages/contracts`                                                                                                                                                                                   |     | `testing`          | `packages/testing`        |
| `sdk-rs`       | `crates/contract-types`                                                                                                                                                                                |     | `web-platform`     | `packages/web-platform`   |
| `envelope`     | `packages/envelope`                                                                                                                                                                                    |     | `knowledge`        | `packages/knowledge`      |
| `provenance`   | `packages/provenance`                                                                                                                                                                                  |     | `data`             | `packages/data`           |
| `artifacts`    | `crates/artifact`                                                                                                                                                                                      |     | `rgpd-kit`         | `packages/rgpd-kit`       |
| `orchestrator` | `crates/agent-orchestrator` + `docs/apps/{harness,memory,orchestrator}.md`                                                                                                                             |     | `classification`   | `packages/classification` |
| `starter`      | `distribution/templates/starter` (canonique — template exit-gate de la vague 1, confirmé par `tools/release/mirror-satellites.sh`) **et** `distribution/templates/bun-app` (second gabarit, même repo) |     | `collab-core`      | `packages/collab-core`    |
|                |                                                                                                                                                                                                        |     | `collab-relay`     | `packages/collab-relay`   |

Ordre de migration imposé par le graphe de dépendances réel (relevé exhaustif de la revue K4, acyclique) : `sdk-ts`, `web-platform`, `testing`, `sdk-rs` d'abord ; puis `auth`, `data`, `ui`, `artifacts`, `orchestrator` ; les autres satellites n'ont aucune dépendance interne ; produits en dernier.

### 4.4 Déjà actifs / réservés / archive

- `website` : activation régularisée par l'ADR (§3.4) — description GitHub corrigée, reçoit la nouvelle page d'accueil et les pages de comparaison ;
- `db-inspect` : déjà indépendant, reçoit sa fiche ;
- `.github` : profil org — README org généré depuis les fiches ;
- `libre-ai` (hub) : archivé en fin de mission, bannière + index de migration.

### 4.5 Chemins racine restants — inventaire exhaustif gaté

La règle « rien n'est perdu » n'est pas une intention : c'est un **gate machine** (§3.6 — diff `git ls-files` ↔ index de migration, échec sur orphelin). Destinations par défaut, affinables à l'inventaire du plan :

- `infrastructure/`, `third_party/` (voir §5.2.4 pour `rustcrypto-aes`) → `governance` sauf meilleure destination ; `.tools/` **n'existe pas** (erreur de la révision 1, retirée) ;
- `.github/` (les 9 workflows du hub) : remplacés par les CI par-repo (§5.3) et les gates de flotte de `governance` ; chaque workflow est tracé « remplacé par X » à l'index ;
- fichiers racine de gouvernance juridique (`LICENSING.md`, `TRADEMARKS.md`, `DATA-PROVENANCE.md`, `REUSE.toml`, `deny.toml`, `llms.txt`) → `governance` ; `LICENSE`, `LICENSES/` : chaque repo naît avec les textes de licence que sa conformité REUSE exige ;
- racines de workspace (`package.json`, `bun.lock`, `bunfig.toml`, `tsconfig.json`, `biome.json`, `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, `.cargo/`) : éclatées — chaque repo porte les siennes (§5.2) ; celles du hub meurent avec lui, tracées à l'index ;
- `README.md`, `README.fr.md`, `SECURITY.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md` : réécrits en fin de mission pour l'archive (bannière + index) ;
- `target/`, `node_modules/` : artefacts non suivis, hors index.

## 5. Mécanique de migration

### 5.1 Histoire préservée — `git filter-repo` par défaut

`git subtree split` est **insuffisant** pour la majorité des cibles : il ne suit pas les renommages (il perdrait 6 des 11 commits de `packages/ui`, dont l'histoire vit d'abord sous `packages/design-system`) et n'accepte qu'un seul préfixe (au moins 9 cibles sont multi-chemins). Le mécanisme par défaut est **`git filter-repo`** (`--path` multiples + `--path-rename`), exécuté dans un clone frais par cible ; `subtree split` reste admis pour un satellite mono-chemin sans renommage. Jamais de squash. L'index de migration relie SHA hub ↔ SHA du premier commit de destination.

**Greffe sur les repos produits non vides** : les 8 homes produits portent une histoire gelée (jusqu'à 53 Mo ; preuve G0–G2). Aucun force push, aucune réécriture : l'histoire migrée arrive comme branche portant l'arbre filtré, reliée à l'histoire gelée par un merge `--allow-unrelated-histories` (le contenu migré fait foi), puis avance `main` par merge commit ordinaire. L'histoire gelée reste intégralement accessible. Préalable par repo : inspection LFS et du volume (un dépôt LFS ne se greffe pas comme un dépôt ordinaire).

### 5.2 Dépendances inter-repos — mécanique réelle et décision de sécurité

La revue K4 d'exécution a établi que la révision 1 était inapplicable telle quelle : les protocoles `catalog:`/`workspace:` (41 références sur 14 manifestes) ne traversent pas une git-dep — le repo le documente lui-même (« bun pm pack materializes workspace:/catalog: refs at pack time ») —, `contracts/` est une entrée de compilation (`include_str!`, `build.rs`) pour 6 crates, et le `[patch.crates-io]` d'`aes` ne se propage pas à travers une git-dep. Mécanique retenue :

1. **Manifestes migrés réécrits en versions concrètes épinglées.** Le catalogue du workspace meurt avec le hub ; chaque repo devient responsable de ses pins (cohérent avec D1). La perte du point de pin unique est assumée ; l'outillage de bump de flotte (agents sous gates) est l'étape ultérieure déjà prévue.
2. **Git-deps GitHub épinglées par SHA** pour l'intra-org (`bun` : `github:libre-ai/<repo>#<sha>` ; `cargo` : `git = "https://github.com/libre-ai/<repo>", rev = "<sha>"`). Consommation Bun : les exports `"bun": "./src/index.ts"` résolvent la source directement — pas de `dist/` requis dans une stack tout-Bun ; les consommateurs non-Bun sont hors périmètre jusqu'à la publication npm (checkpoint ultérieur).
3. **Contrats consommés à la compilation : vendorisation byte-exacte + gate de dérive.** Le pattern existe déjà (`packages/contracts/sync-schemas.ts --check`) : chaque repo consommateur (`sdk-rs`, `notebook`, `policy`, `authz-biscuit`, `orchestrator`, `artifacts`, `ecosystem-engine`) embarque une copie vendorée des fichiers de contrat qu'il compile, avec un gate de dérive octet-par-octet contre la révision épinglée du repo `contracts` (resp. `governance` pour les objets d'écosystème d'`ecosystem-engine`). La canonicité reste au repo `contracts` ; les copies sont des projections vérifiées (I-05), jamais éditées à la main.
4. **Patch cryptographique `aes`** : chaque workspace Rust dont le graphe contient `aes` (aujourd'hui : `notebook`) embarque `third_party/rustcrypto-aes-0.8.4`, re-déclare `[patch.crates-io]`, emporte `PATCH.md` et `.cargo/config.toml` (`+simd128`), et réplique la vérification des octets WASM reproductibles. Un `[patch]` déclaré dans une dépendance est ignoré par Cargo : chaque consommateur final le porte.
5. **Décision de sécurité enregistrée à l'ADR** : les git-deps désarment deux gardes existantes — `cargo deny check sources` (`unknown-git = deny`) et la quarantaine npm `minimumReleaseAge`. Bornes retenues : le `deny.toml` de chaque repo ajoute `allow-git` **restreint à `https://github.com/libre-ai/`** (confiance bornée à l'organisation, chaque bump de SHA passe par une PR revue) ; la quarantaine ne s'applique pas aux git-deps intra-org, remplacée par le régime pin-SHA + revue ; `minimumReleaseAge` reste en vigueur pour tout paquet de registre.
6. **Banc d'essai préalable** : avant le plan d'implémentation de l'étape 4 (§5.6), une fixture d'une demi-heure prouve empiriquement les mécanismes (git-dep Bun consommant un package à exports `bun` ; crate consommant sa copie vendorée ; patch `aes` re-déclaré chez un consommateur git-dep) — les conclusions de la revue reposent sur la source de Bun et la sémantique documentée de Cargo, pas encore sur une exécution.

### 5.3 Gates répliqués par repo — gabarit réel et gates de flotte

Le « gabarit unique » couvre ce qui est réellement réplicable : checkout + toolchain Bun épinglé + install frozen + lint + typecheck + tests + REUSE + DCO + context-hygiene + (si Rust) fmt/clippy/test/deny + secret scanning + push protection + branch protection `main`. Il est distribué comme **workflows réutilisables et composite actions du repo `governance`**, référencés par SHA épinglé (`uses: libre-ai/governance/.github/...@<sha>`) — une évolution de gate est un bump de SHA par repo, dans la culture du pin. Le check `check-bun-manifests` (qui impose aujourd'hui un chemin relatif intra-hub à chaque manifeste) est adapté à cette distribution.

S'y ajoutent, selon le contenu du repo : `check:names` (I-04), `check-personal-data-boundary` (I-21/I-22), `check-no-clever-production` (I-07), la deny-list de marques mortes. Le job « product paths require a work-package » (I-08) meurt avec le hub : l'ADR le remplace par la discipline de roadmap par repo (chaque repo produit trace ses phases dans sa fiche, critères et preuves à l'appui).

**Gates de flotte, exécutés depuis `governance`** (par nature non réplicables) : `inventory-drift` (index ↔ organisation observable), `truth-drift` (manifeste legacy ↔ état live ; l'exemption `PRIVATE_SKIP="policy"`, caduque depuis la bascule public, est levée), `feeds-freshness`, gate de cohérence fiches ↔ README ↔ site (§6), gate d'orphelins de l'index de migration, gate de dérive du gabarit CI, gate de dérive des copies vendorées (§5.2.3).

### 5.4 Règle dure de bascule — et fenêtres de rouge bornées

Un chemin ne quitte le hub qu'après preuve verte côté destination (CI du repo cible verte sur le contenu migré). Jamais de fenêtre où un contenu n'existe nulle part en vert. Trois fenêtres de rouge structurelles sont identifiées et bornées explicitement (jamais cachées — « never hide a red test ») :

1. **Création de repos vs `inventory-drift`** : le gate compare l'inventaire à l'observable dans les deux sens. Séquence imposée : la PR d'inventaire déclarant le lot est pré-approuvée ; la création GitHub (checkpoint propriétaire) est immédiatement suivie de son merge ; le rouge transitoire des PRs concurrentes est borné à cette fenêtre et tracé dans l'évidence du jalon.
2. **Hub en mode démantèlement** : dès la première bascule, chaque PR de retrait d'un chemin ajuste **dans la même PR** les gates du hub qui le référencent (`check-dead-code`, chaîne de référence, manifests, imports). Le vert du hub reste exigé à chaque merge ; son périmètre rétrécit avec l'arbre.
3. **Asset toolchain Bun** : 6 des 9 workflows téléchargent l'archive Bun depuis une release du hub (`BUN_ARCHIVE_URL`). L'asset est re-hébergé sous `governance` **avant** l'archivage du hub, et les workflows migrés pointent la nouvelle URL dès leur naissance.

### 5.5 Photographie initiale

La chaîne de référence du hub est re-jouée verte une dernière fois avant le premier split (état vert connu, digest enregistré dans l'évidence). L'archive du hub reste clonable ; l'index de migration et les `recoverable_at` d'I-23 y résolvent.

### 5.6 Ordre d'exécution

1. housekeeping — merge de cette révision du design, PR `chore/forgetting-primitive`, reliquats statués, chaîne verte + digest ;
2. acte doctrinal — ADR + amendement LEXICON + autorités documentaires (checkpoint : merge = signature) ;
3. schéma des fiches + validateur + agrégateur (dans le hub, migrés ensuite avec `governance`) + **banc d'essai des mécanismes de dépendance (§5.2.6)** ;
4. création `governance` + `contracts`, migration des autorités (checkpoint : création du lot de repos) ; gabarit CI publié par `governance` ;
5. satellites code partagé, dans l'ordre du graphe §4.3 (parallélisables par niveau) ;
6. repos produits + `missions` (parallélisables par repo) ;
7. vague présentation — fiches, README générés, descriptions GitHub, README org, page d'accueil, comparaisons ;
8. gate de cohérence cross-repo + rapport final ;
9. archivage du hub (checkpoint propriétaire final).

## 6. Système de présentation

1. **Fiche `project.v1.yaml` dans chaque repo** : problème/utilisateurs/situation actuelle/résultat cible, périmètre/non-objectifs, dépendances, maturité/confiance/fraîcheur, phases adaptées au type de projet avec critères d'acceptation pondérés et preuves datées. Schéma JSON-Schema versionné + validateur dans `governance`.
2. **Une seule autorité d'état par projet** (résout le doublon relevé en revue K4) : les champs d'état produit aujourd'hui portés par l'inventaire central (`hypothesis`, `evidence_required`, `promotion_criteria`, `kill_predicates`, `exposure`, `benchmark`) **migrent dans la fiche du repo concerné** — la fiche devient l'autorité de l'état du projet. `ecosystem/repositories.v1.yaml` (v2, dans `governance`) devient l'**index topologique** : repos, rôle, couche, visibilité, pointeur vers la fiche — sans duplication d'état. `portfolio.v1.yaml` est absorbé par le même mouvement. L'agrégateur lit les fiches ; `truth-drift`/`inventory-drift` vérifient l'index.
3. **Avancement calculé, jamais déclaré** : l'agrégateur calcule les % depuis les seuls critères `accepted` avec preuve (poids acceptés / poids applicables, par phase puis pondéré par projet). Affichage « X % du périmètre actuellement déclaré ». Les projets sans périmètre stable affichent « Avancement non calculable — périmètre à clarifier » — c'est une information, pas un défaut. Plusieurs satellites et `carriere` seront dans ce cas au départ.
4. **Générés depuis les fiches** (sections entre sentinelles, jamais éditées à la main) : README org (`.github`), tableau « état des projets » de la page d'accueil (`website`), section statut de chaque README de repo. Le gate de cohérence échoue si une section générée diverge de sa fiche.
5. **Texte libre rédigé à la main** dans la structure de la mission : « Pour [utilisateur], qui rencontre [problème], ce projet permet de [résultat observable], en produisant [sorties], sans dépendre de [contrainte] » ; vocabulaire accessible (table de substitution de la mission), zéro technologie ni jargon au premier écran.
6. **Maturité ≠ avancement ≠ confiance**, affichés séparément, avec date de dernière vérification des preuves.
7. **Comparaisons datées** dans `website` : pi.dev, OpenCode, Dust, Onyx, Dify, Flowise/Langflow, Temporal, Langfuse — factuelles, sourcées, avec date de vérification, sans caricature.
8. **Descriptions GitHub** mises à jour par `gh` à l'activation de chaque repo (permission demandée à l'exécution).

## 7. Vérification et critères de fin

1. Chaque repo : CI verte, fiche valide au schéma, README cohérent avec la fiche (gate de divergence exécuté cross-repo depuis `governance`).
2. Le hub : vidé, chaque chemin tracé dans l'index de migration, **gate d'orphelins vert** (aucun chemin sans destination).
3. Rapport de cohérence final (livrable 11 de la mission) : affirmations sans preuve, % non calculables, phases sans critère de sortie, projets sans utilisateur/résultat, divergences présentation↔code, preuves obsolètes, dépendances non documentées.
4. Lecture à trois niveaux vérifiée : comprendre (premier écran + README org + fiche), évaluer (état réel, dépendances, limites, prochaines décisions), vérifier (sources, tests reproductibles, calculs retraçables).
5. Aucun pourcentage manuel nulle part ; aucune capacité prévue présentée comme disponible.

## 8. Exécution

- **Plan écrit** (skill writing-plans) découpé en packages de travail bornés, puis exécution par **agents parallèles par repo**, chacun en worktree auto-nettoyé, prompts fermés (rôle, périmètre, contraintes, format de sortie).
- **Checkpoints propriétaire explicites (hard stops)** : signature de l'ADR (merge) ; création du lot de repos GitHub — en y joignant l'état des scopes du jeton `gh` (suffisants pour créer/protéger/décrire/archiver ; `admin:org` absent : pas de rulesets d'organisation ; `delete_repo` absent : le rollback d'une création ratée est un renommage, jamais une suppression) ; première bascule de visibilité/description par repo ; archivage final du hub.
- **Protocole de revue du repo respecté** : passes role-separated sur commits immuables pour contrats, auth, doctrine (`docs/reviews/AGENT-REVIEW-PROTOCOL.md`).
- **Actions externes propriétaire** (hors de portée agent) : réservation npm `@libre-ai` si la distribution registre est un jour voulue — non requise par cette mission grâce aux git-deps.

## 9. Limites et risques

| Risque / limite                                                                                                         | Traitement                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Les moteurs produits n'existent pas — les repos produits porteront leur app réelle mais des phases moteur `not_started` | Les fiches l'affichent honnêtement ; aucun % gonflé                                                                                    |
| Éclatement des workspaces = ~34 CI à maintenir                                                                          | Workflows réutilisables `governance` épinglés par SHA + gate de dérive de gabarit ; coût de bump assumé, outillage de flotte ultérieur |
| git-deps épinglées = montées de version inter-repos manuelles                                                           | Assumé (culture du pin) ; graphe réel peu profond et acyclique (§4.3) ; outillage de bump possible plus tard                           |
| git-deps = `allow-git` dans deny.toml + quarantaine npm inapplicable intra-org                                          | Décision de sécurité enregistrée à l'ADR, confiance bornée à l'org, pin SHA + revue par bump (§5.2.5)                                  |
| La chaîne de référence du hub (preuve G2) cesse d'être re-jouable après démantèlement                                   | Photographie verte finale + digest enregistrés avant le premier split ; l'archive du hub reste clonable                                |
| Copies vendorées de contrats = risque de dérive                                                                         | Gate de dérive octet-par-octet par repo consommateur, épinglé sur la révision de `contracts` (§5.2.3)                                  |
| Histoire gelée des homes produits vs histoire migrée                                                                    | Greffe par merge `--allow-unrelated-histories`, jamais de force push ; inspection LFS et volume préalable (§5.1)                       |
| Fenêtres de rouge pendant l'éclatement                                                                                  | Trois fenêtres identifiées, bornées et tracées (§5.4) ; jamais de rouge caché                                                          |
| STATUS/GOALS du hub périmés pendant la transition                                                                       | Mis à jour par l'acte doctrinal, puis remplacés par l'index de migration                                                               |

## 10. Questions ouvertes

Aucune bloquante. Le banc d'essai §5.2.6 est un préalable du plan d'implémentation de l'étape 4 (confirmation empirique des mécanismes de dépendance) ; les micro-décisions de destination restantes sont tranchées à l'inventaire exhaustif du plan, chacune tracée dans l'index de migration et vérifiée par le gate d'orphelins.
