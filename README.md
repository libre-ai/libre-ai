# Libre AI — dépôt de base canonique

> Libre AI est un laboratoire open source et souverain qui construit pour ses propres besoins les capacités nécessaires au logiciel de l'ère IA-native, les met à l'épreuve dans des expériences réelles, publie les évidences comme les limites, puis distribue les résultats afin que d'autres puissent les reproduire et les améliorer.

C'est la mission, reprise de [`vision.md`](vision.md). La constellation est construite par des agents IA sous une méthode gouvernée, [Polaris](docs/method/POLARIS.md) : la fabrique est le premier produit — [sa fiche produit](docs/positioning/method.md). **Aucun produit n'est encore publié.** Ce que ce dépôt revendique se vérifie ; ce qui ne se vérifie pas n'est pas revendiqué.

## Ce qu'un tiers peut faire aujourd'hui

| Action                                                                                                                                                          | Où                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vérifier la chaîne de référence** — reconstruire les fondations depuis un checkout vierge et comparer le digest au digest publié                              | bloc « Vérifier en ~10 minutes » ci-dessous ; harness : [`verification/harness/reference-chain.ts`](verification/harness/reference-chain.ts)                       |
| **Consommer l'index machine** — la topologie publique en JSON déterministe, projection de l'inventaire autoritaire                                              | [`distribution/index/repositories.v1.json`](distribution/index/repositories.v1.json) (source : [`ecosystem/repositories.v1.yaml`](ecosystem/repositories.v1.yaml)) |
| **Utiliser `db-inspect`** — le seul exécutable public de l'organisation aujourd'hui : gate d'inspection de schéma PostgreSQL fail-closed, en releases épinglées | [github.com/libre-ai/db-inspect](https://github.com/libre-ai/db-inspect)                                                                                           |
| **Lire les preuves** — journal public des verdicts de gates, rapports datés, métriques de couverture                                                            | [`distribution/evidence/`](distribution/evidence) ; comment chaque type d'affirmation se vérifie : [`docs/positioning/evidence.md`](docs/positioning/evidence.md)  |

## Vérifier en ~10 minutes

Prérequis : [Bun](https://bun.sh) ≥ 1.4.0, une toolchain Rust (rustup lit [`rust-toolchain.toml`](rust-toolchain.toml)) et les navigateurs Playwright (`bunx playwright install`, une seule fois). La première exécution est dominée par la compilation Rust.

```console
git clone https://github.com/libre-ai/libre-ai.git
cd libre-ai
bun install --frozen-lockfile
bun run check:contracts
bun verification/harness/reference-chain.ts
```

`check:contracts` vérifie le catalogue d'autorités verrouillé (entrées du catalogue, paires schéma-fixture, opérations HTTP) et l'intégralité des vecteurs golden des moteurs. La chaîne de référence exécute ensuite dix étapes — contrats, projections générées, plateforme web Bun + React, autorisation Biscuit, mondes WIT, crates proof/artifact, scan de secrets, absence de revendication de production, barrière RLS deux-tenants, e2e Playwright trois moteurs — puis imprime un rapport JSON ancré par digest. Dernière ligne attendue quand les dix étapes passent :

```text
Reference chain passed — digest f45dfad03581f3d56ea53ca74a7b9ac3034ef7ce7013eebe6eac71cc3959a89f
```

Le digest est un SHA-256 sur les seules paires ordonnées `étape:statut` : reproductible octet pour octet, recalculable à la main, différent dès qu'une étape échoue ou est sautée. Il correspond à l'évidence publiée dans [`verification/harness/wp-g2-q01-reference-chain-evidence.md`](verification/harness/wp-g2-q01-reference-chain-evidence.md).

Pour consommer l'index machine (avec `jq`) :

```console
jq '.repositories[] | {repository, layer, exposure}' distribution/index/repositories.v1.json
```

## Ce que Libre AI ne fait pas

Les non-objectifs tenus par [`vision.md`](vision.md) §28 — sélection des plus discriminants pour un lecteur extérieur :

- aucun hyperscaler américain pour le runtime applicatif ou les données ;
- aucun framework serveur au-dessus de `Bun.serve` ;
- pas d'import des historiques Git dans le monorepo — les 18 dépôts historiques sont des archives figées ;
- pas de cutovers produit successifs ni de compatibilité transitoire pendant la reconstruction ;
- pas de promesse desktop/mobile via Bun.

Le positionnement complet — ce que Libre AI n'est pas, et ce qui le distingue factuellement des acteurs voisins : [`docs/positioning/non-goals.md`](docs/positioning/non-goals.md).

## La constellation en quatre couches

D'après [ADR-0009 §2](docs/adr/0009-constellation-portfolio-and-method.md) — un moyeu, quatre couches ; l'inventaire machine-lisible fait foi, aucun décompte codé en dur :

- **Moyeu** (`libre-ai/libre-ai`) : l'autorité unique — contrats, spécifications, doctrine — et l'atelier des briques à fort churn.
- **Couche 1 — les apps** : des outils pour utilisateurs finaux, explicables, locaux, réversibles ; les preuves vivantes de la méthode.
- **Couche 2 — Polaris** : la méthode d'orchestration gouvernable elle-même, productisée pour les équipes qui opèrent des flottes d'agents.
- **Couche 3 — l'infrastructure de confiance** : les briques qui rendent les agents dignes de confiance par construction (envelope, provenance, proof).
- **Couche 4 — l'atelier applicatif** : les briques pour assembler vite une application souveraine et vérifiable (ui, auth, sdk).

## État, sans enjolivement

- **Aucun produit n'est encore publié.** Les dépôts produits sont des réserves publiques ; tout le travail en cours se passe ici.
- Les phases G0–G2 de la refondation sont closes ; l'état vivant est [`STATUS.md`](STATUS.md), le séquencement [`docs/transformation/EXECUTION-SEQUENCING.md`](docs/transformation/EXECUTION-SEQUENCING.md).
- La couverture d'automatisation réelle mesurée est **0 %** ([`distribution/evidence/coverage-2026-07-22.json`](distribution/evidence/coverage-2026-07-22.json)) : le plancher honnête que les vagues suivantes doivent faire monter — mesuré depuis l'historique des merges, pas déclaré.
- Chaque gate franchie, chaque arrêt et chaque refus est journalisé dans [`distribution/evidence/gate-acceptance-log.md`](distribution/evidence/gate-acceptance-log.md), ligne par ligne, avec sa référence vérifiable.
- Les audits de parité face aux meilleurs produits du marché sont publiés avec leurs chiffres défavorables ([`docs/parity/`](docs/parity)).

## Pour travailler dans ce dépôt

### Comment ce dépôt s'articule avec les autres

La cible est un dépôt par produit ([ADR-0008](docs/adr/0008-multi-repo-target-topology-and-brand.md)) : chaque dépôt produit rouvrira comme une unité indépendante et interopérable, consommant cette base comme dépendance versionnée. Jusqu'à son activation par décision du propriétaire, un dépôt produit reste une réserve publique et tout son travail se passe ici. L'inventaire autoritaire des dépôts et de leurs états d'exposition est [`ecosystem/repositories.v1.yaml`](ecosystem/repositories.v1.yaml) ; les 18 dépôts historiques sont figés aux SHAs enregistrés dans [`ecosystem/LEGACY-MANIFEST.yaml`](ecosystem/LEGACY-MANIFEST.yaml).

### Ce qu'il contient

| Chemin                                            | Ce qui y vit                                                                                                                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/`](apps)                                   | Les hôtes produits : boussole, missions, model-policy, notebook, practices, radar, sessions, specifications                                                                                           |
| [`packages/`](packages)                           | Les briques TypeScript partagées par les produits : web-platform, ui, contracts, data, auth-web, envelope, provenance, classification, knowledge, collab-core, collab-relay, policy-core-ref, testing |
| [`crates/`](crates)                               | Les moteurs Rust — cœurs déterministes là où durabilité et sécurité le justifient                                                                                                                     |
| [`contracts/`](contracts)                         | La surface d'interopérabilité verrouillée : JSON Schemas, OpenAPI, mondes WIT, vecteurs golden                                                                                                        |
| [`docs/`](docs)                                   | La doctrine : ADRs, cahiers des charges produits ([`docs/apps/`](docs/apps)), spécifications, architecture cible, programme de transformation                                                         |
| [`ecosystem/`](ecosystem)                         | La vérité machine-lisible : inventaire des dépôts, manifeste legacy, registres du portefeuille                                                                                                        |
| [`distribution/evidence/`](distribution/evidence) | L'évidence publique : journal d'acceptation des portes, rapports, hashes d'engagement                                                                                                                 |
| [`prompts/`](prompts)                             | Les prompts d'exécution par phase du flux agentique gouverné                                                                                                                                          |

### Décisions d'ingénierie

- Bun `>=1.4.0` fullstack + TypeScript strict + React 19 pour le web ; la CI conserve le pin qualifié exact.
- Rust pour les moteurs spécialisés, le WASM, la sécurité, la preuve et le tooling système.
- Un `bun.lock`, un workspace Cargo, une source de contrats.
- Clever Cloud Paris/UE comme cible de déploiement.
- Cible multi-dépôts : socle + dépôts produits réels construits sur lui ([ADR-0008](docs/adr/0008-multi-repo-target-topology-and-brand.md)) ; « projection » désigne des artefacts générés, jamais des dépôts.

### Comment le travail est gouverné

La constellation est construite par des agents IA sous une méthode gouvernée ([ADR-0009](docs/adr/0009-constellation-portfolio-and-method.md)) : plans bornés, preuves à chaque étape, portes de contrôle humaines, refus documentés. Ce qui est doctrine — et rien d'autre — est consigné dans [`docs/decisions/INVARIANTS.md`](docs/decisions/INVARIANTS.md) ; chaque merge porte un sign-off DCO et des checks requis verts ; la trace d'évidence publique vit dans [`distribution/evidence/`](distribution/evidence).

### Lire dans cet ordre

1. [`vision.md`](vision.md) — pourquoi une reconstruction greenfield, à horizon 5–10 ans
2. [`docs/decisions/DECISION-REGISTER.md`](docs/decisions/DECISION-REGISTER.md) et [`docs/decisions/INVARIANTS.md`](docs/decisions/INVARIANTS.md) — ce qui a été décidé, ce qui est doctrine
3. [`GOALS.md`](GOALS.md) et [`STATUS.md`](STATUS.md) — où nous en sommes
4. [`docs/architecture/TARGET.md`](docs/architecture/TARGET.md) — l'architecture cible
5. [`docs/adr/`](docs/adr) — les décisions d'architecture
6. [`docs/specifications/SPECIFICATION-STANDARD.md`](docs/specifications/SPECIFICATION-STANDARD.md), [`DATA-LIFECYCLE.md`](docs/specifications/DATA-LIFECYCLE.md) et [`IDENTITY-AUTHORIZATION.md`](docs/specifications/IDENTITY-AUTHORIZATION.md) — les spécifications transverses
7. [`LICENSING.md`](LICENSING.md), [`TRADEMARKS.md`](TRADEMARKS.md) et [`DATA-PROVENANCE.md`](DATA-PROVENANCE.md) — la gouvernance juridique

### Contribuer

Les issues et pull requests de tous les produits se passent ici — voir [`CONTRIBUTING.md`](CONTRIBUTING.md) (dont les trois chemins de contribution externe praticables aujourd'hui) et [`SECURITY.md`](SECURITY.md). Chaque commit porte un sign-off DCO.

### Licence

Licence différenciée ([ADR-0004](docs/adr/0004-licensing-governance.md)) : EUPL-1.2 pour le logiciel first-party, Apache-2.0 et MIT sur des frontières désignées, CC BY 4.0 pour la documentation éditoriale — voir [`LICENSING.md`](LICENSING.md).
