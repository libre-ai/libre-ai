# Libre AI

Monorepo canonique de l’écosystème Libre AI reconstruit pour l’ère IA-native.

## Décisions actives

- migration Big Bang depuis les repositories historiques figés ;
- Bun `>=1.4.0` fullstack + TypeScript strict + React 19 pour le web ; la CI conserve le pin qualifié exact ;
- Rust pour les moteurs spécialisés, WASM, sécurité, preuve et tooling système ;
- un `bun.lock`, un workspace Cargo, une source de contrats ;
- Clever Cloud Paris/UE comme cible de déploiement ;
- repositories spécialisés générés comme projections à sens unique.

Lire dans cet ordre :

1. [`vision.md`](vision.md)
2. [`docs/decisions/DECISION-REGISTER.md`](docs/decisions/DECISION-REGISTER.md)
3. [`GOALS.md`](GOALS.md) et [`STATUS.md`](STATUS.md)
4. [`LICENSING.md`](LICENSING.md), [`TRADEMARKS.md`](TRADEMARKS.md) et [`DATA-PROVENANCE.md`](DATA-PROVENANCE.md)
5. [`docs/adr/0001-bun-fullstack-rust-specialized-big-bang.md`](docs/adr/0001-bun-fullstack-rust-specialized-big-bang.md)
6. [`docs/adr/0002-g1-cross-cutting-product-decisions.md`](docs/adr/0002-g1-cross-cutting-product-decisions.md)
7. [`docs/adr/0004-licensing-governance.md`](docs/adr/0004-licensing-governance.md)
8. [`docs/adr/0005-notebook-gate-b-host-qualification.md`](docs/adr/0005-notebook-gate-b-host-qualification.md)
9. [`docs/specifications/SPECIFICATION-STANDARD.md`](docs/specifications/SPECIFICATION-STANDARD.md)
10. [`docs/specifications/DATA-LIFECYCLE.md`](docs/specifications/DATA-LIFECYCLE.md) et [`IDENTITY-AUTHORIZATION.md`](docs/specifications/IDENTITY-AUTHORIZATION.md)
11. [`docs/architecture/TARGET.md`](docs/architecture/TARGET.md)
12. [`docs/transformation/CLEANUP.md`](docs/transformation/CLEANUP.md)
13. [`docs/transformation/BIG-BANG.md`](docs/transformation/BIG-BANG.md)
14. [`docs/transformation/WORKSTREAMS.md`](docs/transformation/WORKSTREAMS.md)
15. [`prompts/`](prompts/) pour l’exécution par phase

## État

Les 18 repositories historiques sont figés et archivés aux SHAs enregistrés dans `ecosystem/LEGACY-MANIFEST.yaml`. G0 et le Specification Lock sont fermés ; les 85 autorités du catalogue sont verrouillées. Foundation Build poursuit uniquement la qualification Notebook Core v2 Gate B et les autres fondations explicitement contrôlées. Un host Notebook désactivé peut traiter les fixtures publiques de qualification, mais Gate B, les données utilisateur, les nouveaux moteurs produit, la production et la release restent bloqués.
