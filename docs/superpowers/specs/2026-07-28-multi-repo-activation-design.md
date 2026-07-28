# Design — Activation générale multi-repo et refonte de présentation

- **Date :** 2026-07-28
- **Statut :** validé sur le fond par le propriétaire en session (les quatre décisions §2) ; ce document en est la forme écrite, soumise à relecture avant plan d'implémentation.
- **Portée :** l'organisation GitHub `libre-ai` entière — le hub `libre-ai/libre-ai`, les repos gelés/réservés existants, les repos à créer, et toute la présentation publique (README org, page d'accueil, README/description/roadmap par repo, fiches structurées, comparaisons).

## 1. Contexte et état constaté (2026-07-28)

- G0–G2 sont fermés ; la doctrine en vigueur (ADR-0008/0009/0011) prévoit une activation **par vagues** des satellites, chaque activation étant une décision propriétaire (I-17), un satellite existant d'abord comme package publié (I-16).
- Le hub porte tout le contenu réel : 13 packages TypeScript, 7 crates Rust, 8 applications réelles (code + tests + e2e), 85+ autorités de contrats, la doctrine, l'index d'écosystème, l'outillage.
- Côté GitHub : 13 repos — le hub, 7 homes produits `[Frozen]`, `website`/`carriere` `[Reserved]`, `missions` `[Frozen]`, `db-inspect` (outil actif), `.github` (profil org).
- **Dérives factuelles relevées** (à corriger par cette mission) :
  - le repo GitHub s'appelle `missions` alors que le LEXICON §1.1 réserve `agent-board` ;
  - `website` est développé dans son propre repo (7 PRs mergées) alors que sa description GitHub affirme « developed in libre-ai/libre-ai » ;
  - `STATUS.md` est en retard sur le code (le crate `policy-core` existe, les packages `envelope`/`provenance` sont nés) ;
  - le LEXICON ignore 9 packages nés après sa signature.
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

- **un repo par package/crate** (pas de regroupement) — cohérent avec « un repo = un périmètre » et la règle de nommage déterministe du LEXICON §2.5 ;
- **dépendances inter-repos par git-deps GitHub** (commits épinglés dans `bun.lock`/`Cargo.lock`) — reste dans l'exception US déjà acceptée (GitHub, code public), zéro création de compte ; la publication npm/crates.io devient une étape de distribution ultérieure, checkpoint propriétaire.

## 3. Acte doctrinal (préalable à tout)

Un nouvel ADR « Activation générale et démantèlement du hub » qui :

1. **supersède** le séquencement par vagues (ADR-0009, ADR-0011 pour sa partie séquencement) et la doctrine « tout le partagé reste au hub » (ADR-0008 §5) ;
2. **amende I-02** (la cible multi-repo devient l'état courant, pas une cible différée) et **I-16** (un satellite n'attend plus d'exister comme package publié avant d'être un repo) ;
3. **enregistre D1–D4** comme décisions propriétaire datées ;
4. **étend le LEXICON** (même procédure que sa signature : production → revue K4 → arrêt dur → merge = signature propriétaire) :
   - noms d'autorité : `governance`, `contracts` ;
   - noms des packages nés après la carte : `testing`, `web-platform`, `knowledge`, `data`, `rgpd-kit`, `classification`, `collab-core`, `collab-relay` (le package `policy-core-ref` rejoint le repo produit `policy`, pas un satellite) ;
   - régularisation `agent-board` → `missions` (constat de la réalité GitHub) ;
5. **institue l'index de migration** : chaque chemin du hub → sa destination (repo + SHA du premier commit), vérifiable ; le hub passe en état « démantèlement en cours » puis « archivé » en fin de mission ;
6. **met à jour** `AGENTS.md`, `GOALS.md`, `STATUS.md`, `ROADMAP.md` en conséquence (le hub cesse d'être « the single authority »).

## 4. Topologie cible (~30 repos)

### 4.1 Autorités (2 repos à créer)

| Repo         | Périmètre                                                                                                                                       | Reçoit du hub                                                                                                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `governance` | doctrine, décisions, invariants, LEXICON, index écosystème, schéma des fiches projet, agrégateur d'avancement, outillage d'écosystème, evidence | `docs/decisions`, `docs/adr`, `docs/method`, `docs/transformation`, `docs/reviews`, `docs/security`, `docs/positioning`, `docs/parity`, `docs/rfcs`, `GOALS.md`, `STATUS.md`, `ROADMAP.md`, `vision.md`, `ecosystem/`, `tools/`, `verification/`, `prompts/`, `distribution/{index,evidence,feeds}` |
| `contracts`  | les 85+ autorités canoniques, catalog, compatibilité, gates contrats                                                                            | `contracts/`, `docs/API-STABILITY.md`, `COMPATIBILITY`                                                                                                                                                                                                                                              |

### 4.2 Produits (8 repos existants, gelés → activés)

| Repo                 | Reçoit du hub                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `notebook`           | `apps/notebook`, `crates/notebook-core`, specs Notebook                                   |
| `feed-radar`         | `apps/radar`, specs Radar                                                                 |
| `boussole-politique` | `apps/boussole`, specs Boussole                                                           |
| `missions`           | `apps/missions`, specs Missions/Agent Board                                               |
| `policy`             | `apps/model-policy`, `crates/policy-core`, `packages/policy-core-ref`, specs Model Policy |
| `ai-practices`       | `apps/practices`, specs AI Practices                                                      |
| `sessions`           | `apps/sessions`, specs Sessions                                                           |
| `spec-studio`        | `apps/specifications` (à confirmer à l'inventaire du plan), specs Spec Studio             |

Les specs par app vivent aujourd'hui sous `docs/apps` et `docs/specifications` : le plan les ventile chemin par chemin vers les repos produits.

### 4.3 Satellites code partagé (19 repos à créer)

| Repo           | Source hub                       |     | Repo               | Source hub                |
| -------------- | -------------------------------- | --- | ------------------ | ------------------------- |
| `ui`           | `packages/ui`                    |     | `authz-biscuit`    | `crates/authz-biscuit`    |
| `auth`         | `packages/auth-web`              |     | `ecosystem-engine` | `crates/ecosystem-engine` |
| `sdk-ts`       | `packages/contracts`             |     | `testing`          | `packages/testing`        |
| `sdk-rs`       | `crates/contract-types`          |     | `web-platform`     | `packages/web-platform`   |
| `envelope`     | `packages/envelope`              |     | `knowledge`        | `packages/knowledge`      |
| `provenance`   | `packages/provenance`            |     | `data`             | `packages/data`           |
| `artifacts`    | `crates/artifact`                |     | `rgpd-kit`         | `packages/rgpd-kit`       |
| `orchestrator` | `crates/agent-orchestrator`      |     | `classification`   | `packages/classification` |
| `starter`      | `distribution/templates/bun-app` |     | `collab-core`      | `packages/collab-core`    |
|                |                                  |     | `collab-relay`     | `packages/collab-relay`   |

### 4.4 Déjà actifs / réservés / archive

- `website` : déjà de facto actif — description GitHub corrigée, reçoit la nouvelle page d'accueil et les pages de comparaison ;
- `db-inspect` : déjà indépendant, reçoit sa fiche ;
- `.github` : profil org — README org généré depuis les fiches ;
- `carriere` : réservé — fiche seulement, pas de code ;
- `libre-ai` (hub) : archivé en fin de mission, bannière + index de migration.

### 4.5 Chemins restants à ventiler (micro-décisions du plan, non bloquantes)

`toolchains/` (archive Bun canary), `infrastructure/`, `third_party/`, `.tools/`, `docs/toolchain`, `docs/superpowers`, fichiers racine de gouvernance juridique (`LICENSING.md`, `TRADEMARKS.md`, `DATA-PROVENANCE.md`, `REUSE.toml`, `deny.toml`, `llms.txt`). Destination par défaut : `governance`, sauf meilleure destination identifiée à l'inventaire exhaustif du plan. Règle : **rien n'est perdu, chaque chemin a une destination tracée dans l'index de migration.**

## 5. Mécanique de migration

1. **Histoire préservée** : chaque migration se fait par `git subtree split` (ou `git filter-repo`) — chaque repo naît avec l'historique réel de ses chemins, jamais un squash. L'index de migration relie SHA hub ↔ SHA du premier commit de destination.
2. **Dépendances inter-repos** : git-deps GitHub épinglées (`bun` et `cargo` les supportent nativement). Aucun registre nouveau, aucun compte nouveau.
3. **Gates répliqués par repo** avant toute bascule : qualité (Bun et/ou Rust selon contenu), DCO, REUSE/licences, `context-hygiene` (invariant de la racine PERSO), secret scanning + push protection, branch protection sur `main`.
4. **Règle dure de bascule** : un chemin ne quitte le hub qu'après preuve verte côté destination (CI du repo cible verte sur le contenu migré). Jamais de fenêtre où le contenu n'existe nulle part en vert.
5. **Photographie initiale** : la chaîne de référence du hub est re-jouée verte une dernière fois avant le premier split (état vert connu, digest enregistré).
6. **Ordre d'exécution** :
   1. housekeeping — PR des 2 commits locaux `chore/forgetting-primitive` ; commit séparé du WIP propriétaire (`policy` → public + re-audit) après confirmation ;
   2. acte doctrinal — ADR + extension LEXICON + mises à jour AGENTS/GOALS/STATUS/ROADMAP (checkpoint : merge = signature) ;
   3. schéma des fiches + validateur + agrégateur (dans le hub, migrés ensuite avec `governance`) ;
   4. création `governance` + `contracts`, migration des autorités (checkpoint : création du lot de repos) ;
   5. satellites code partagé (parallélisables par repo) ;
   6. repos produits (parallélisables par repo) ;
   7. vague présentation — fiches, README générés, descriptions GitHub, README org, page d'accueil, comparaisons ;
   8. gate de cohérence cross-repo + rapport final ;
   9. archivage du hub (checkpoint propriétaire final).

## 6. Système de présentation

1. **Fiche `project.v1.yaml` dans chaque repo** : problème/utilisateurs/situation actuelle/résultat cible, périmètre/non-objectifs, dépendances, maturité/confiance/fraîcheur, phases adaptées au type de projet avec critères d'acceptation pondérés et preuves datées. Schéma JSON-Schema versionné + validateur dans `governance`.
2. **Avancement calculé, jamais déclaré** : l'agrégateur calcule les % depuis les seuls critères `accepted` avec preuve (formules de la mission : poids acceptés / poids applicables, par phase puis pondéré par projet). Affichage « X % du périmètre actuellement déclaré ». Les projets sans périmètre stable affichent « Avancement non calculable — périmètre à clarifier » — c'est une information, pas un défaut. Plusieurs satellites et `carriere` seront dans ce cas au départ.
3. **Générés depuis les fiches** (sections entre sentinelles, jamais éditées à la main) : README org (`.github`), tableau « état des projets » de la page d'accueil (`website`), section statut de chaque README de repo. Le gate de cohérence échoue si une section générée diverge de sa fiche.
4. **Texte libre rédigé à la main** dans la structure de la mission : « Pour [utilisateur], qui rencontre [problème], ce projet permet de [résultat observable], en produisant [sorties], sans dépendre de [contrainte] » ; vocabulaire accessible (table de substitution de la mission), zéro technologie ni jargon au premier écran.
5. **Maturité ≠ avancement ≠ confiance**, affichés séparément, avec date de dernière vérification des preuves.
6. **Comparaisons datées** dans `website` : pi.dev, OpenCode, Dust, Onyx, Dify, Flowise/Langflow, Temporal, Langfuse — factuelles, sourcées, avec date de vérification, sans caricature.
7. **Descriptions GitHub** mises à jour par `gh` à l'activation de chaque repo (permission demandée à l'exécution).

## 7. Vérification et critères de fin

1. Chaque repo : CI verte, fiche valide au schéma, README cohérent avec la fiche (gate de divergence exécuté cross-repo depuis `governance`).
2. Le hub : vidé, chaque chemin tracé dans l'index de migration, aucun contenu orphelin.
3. Rapport de cohérence final (livrable 11 de la mission) : affirmations sans preuve, % non calculables, phases sans critère de sortie, projets sans utilisateur/résultat, divergences présentation↔code, preuves obsolètes, dépendances non documentées.
4. Lecture à trois niveaux vérifiée : comprendre (premier écran + README org + fiche), évaluer (état réel, dépendances, limites, prochaines décisions), vérifier (sources, tests reproductibles, calculs retraçables).
5. Aucun pourcentage manuel nulle part ; aucune capacité prévue présentée comme disponible.

## 8. Exécution

- **Plan écrit** (skill writing-plans) découpé en packages de travail bornés, puis exécution par **agents parallèles par repo** (les migrations satellites/produits sont indépendantes une fois les autorités en place), chacun en worktree auto-nettoyé, prompts fermés (rôle, périmètre, contraintes, format de sortie).
- **Checkpoints propriétaire explicites (hard stops)** : signature de l'ADR (merge), création du lot de repos GitHub, bascule de visibilité/description par repo, archivage final du hub.
- **Protocole de revue du repo respecté** : passes de revue role-separated sur commits immuables pour contrats, auth, doctrine (`docs/reviews/AGENT-REVIEW-PROTOCOL.md`).
- **Actions externes propriétaire** (hors de portée agent) : réservation npm `@libre-ai` si la distribution registre est un jour voulue — non requise par cette mission grâce aux git-deps.

## 9. Limites et risques

| Risque / limite                                                                                                         | Traitement                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Les moteurs produits n'existent pas — les repos produits porteront leur app réelle mais des phases moteur `not_started` | Les fiches l'affichent honnêtement ; aucun % gonflé                                                     |
| Éclatement des workspaces = ~30 CI à répliquer et maintenir                                                             | Gabarit de CI unique paramétré, répliqué mécaniquement ; gate de dérive de gabarit dans `governance`    |
| git-deps épinglées = montées de version inter-repos manuelles                                                           | Assumé (cohérent avec la culture du pin) ; outillage de bump possible plus tard                         |
| La chaîne de référence du hub (preuve G2) cesse d'être re-jouable après démantèlement                                   | Photographie verte finale + digest enregistrés avant le premier split ; l'archive du hub reste clonable |
| `spec-studio` ↔ `apps/specifications` : correspondance supposée                                                         | Confirmée à l'inventaire du plan avant migration                                                        |
| Collision de nom `missions` vs LEXICON `agent-board`                                                                    | Régularisée par l'ADR (constat de réalité)                                                              |
| STATUS/GOALS du hub périmés pendant la transition                                                                       | Mis à jour par l'acte doctrinal, puis remplacés par l'index de migration                                |

## 10. Questions ouvertes

Aucune bloquante. Les micro-décisions restantes (destinations §4.5, correspondance `spec-studio`) sont tranchées à l'inventaire exhaustif du plan d'implémentation, chacune tracée dans l'index de migration.
