[English](README.md) · **Français**

# Libre AI — dépôt de base canonique

**Tout ce que Libre AI construit se construit d'abord ici.** Ce monorepo porte les contrats, les spécifications, la doctrine, les fondations partagées et les premiers moteurs produits de toute la constellation — jusqu'à ce que chaque produit prenne son envol dans son propre dépôt.

Vous découvrez ? Le [profil de l'organisation](https://github.com/libre-ai) raconte l'histoire pour les humains : ce que nous construisons, comment, et pourquoi la méthode elle-même est le premier produit.

## Comment ce dépôt s'articule avec les autres

La cible est un dépôt par produit ([ADR-0008](docs/adr/0008-multi-repo-target-topology-and-brand.md)) : chaque dépôt produit rouvrira comme une unité indépendante et interopérable, consommant cette base comme dépendance versionnée. Jusqu'à son activation par décision du propriétaire, un dépôt produit reste une réserve publique et tout son travail se passe ici. L'inventaire autoritaire des dépôts et de leurs états d'exposition est [`ecosystem/repositories.v1.yaml`](ecosystem/repositories.v1.yaml) ; les 18 dépôts historiques sont figés aux SHAs enregistrés dans [`ecosystem/LEGACY-MANIFEST.yaml`](ecosystem/LEGACY-MANIFEST.yaml).

## Ce qu'il contient

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

## Décisions d'ingénierie

- Bun `>=1.4.0` fullstack + TypeScript strict + React 19 pour le web ; la CI conserve le pin qualifié exact.
- Rust pour les moteurs spécialisés, le WASM, la sécurité, la preuve et le tooling système.
- Un `bun.lock`, un workspace Cargo, une source de contrats.
- Clever Cloud Paris/UE comme cible de déploiement.
- Cible multi-dépôts : socle + dépôts produits réels construits sur lui ([ADR-0008](docs/adr/0008-multi-repo-target-topology-and-brand.md)) ; « projection » désigne des artefacts générés, jamais des dépôts.

## Comment le travail est gouverné

La constellation est construite par des agents IA sous une méthode gouvernée ([ADR-0009](docs/adr/0009-constellation-portfolio-and-method.md)) : plans bornés, preuves à chaque étape, portes de contrôle humaines, refus documentés. Ce qui est doctrine — et rien d'autre — est consigné dans [`docs/decisions/INVARIANTS.md`](docs/decisions/INVARIANTS.md) ; chaque merge porte un sign-off DCO et des checks requis verts ; la trace d'évidence publique vit dans [`distribution/evidence/`](distribution/evidence).

## État

G0–G2 sont closes ; la vague 1 (satellites couche 4) s'ouvre, séquencée par [`docs/transformation/EXECUTION-SEQUENCING.md`](docs/transformation/EXECUTION-SEQUENCING.md). État vivant : [`STATUS.md`](STATUS.md) · objectifs : [`GOALS.md`](GOALS.md) · feuille de route : [`ROADMAP.md`](ROADMAP.md).

## Lire dans cet ordre

1. [`vision.md`](vision.md) — pourquoi une reconstruction greenfield, à horizon 5–10 ans
2. [`docs/decisions/DECISION-REGISTER.md`](docs/decisions/DECISION-REGISTER.md) et [`docs/decisions/INVARIANTS.md`](docs/decisions/INVARIANTS.md) — ce qui a été décidé, ce qui est doctrine
3. [`GOALS.md`](GOALS.md) et [`STATUS.md`](STATUS.md) — où nous en sommes
4. [`docs/architecture/TARGET.md`](docs/architecture/TARGET.md) — l'architecture cible
5. [`docs/adr/`](docs/adr) — les décisions d'architecture
6. [`docs/specifications/SPECIFICATION-STANDARD.md`](docs/specifications/SPECIFICATION-STANDARD.md), [`DATA-LIFECYCLE.md`](docs/specifications/DATA-LIFECYCLE.md) et [`IDENTITY-AUTHORIZATION.md`](docs/specifications/IDENTITY-AUTHORIZATION.md) — les spécifications transverses
7. [`LICENSING.md`](LICENSING.md), [`TRADEMARKS.md`](TRADEMARKS.md) et [`DATA-PROVENANCE.md`](DATA-PROVENANCE.md) — la gouvernance juridique

## Contribuer

Les issues et pull requests de tous les produits se passent ici — voir [`CONTRIBUTING.md`](CONTRIBUTING.md) et [`SECURITY.md`](SECURITY.md). Chaque commit porte un sign-off DCO.

## Licence

Licence différenciée ([ADR-0004](docs/adr/0004-licensing-governance.md)) : EUPL-1.2 pour le logiciel first-party, Apache-2.0 et MIT sur des frontières désignées, CC BY 4.0 pour la documentation éditoriale — voir [`LICENSING.md`](LICENSING.md).
