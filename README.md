# Libre AI

Monorepo canonique de l’écosystème Libre AI reconstruit pour l’ère IA-native.

## Décisions actives

- migration Big Bang depuis les repositories historiques figés ;
- Bun fullstack + TypeScript strict + React 19 pour le web ;
- Rust pour les moteurs spécialisés, WASM, sécurité, preuve et tooling système ;
- un `bun.lock`, un workspace Cargo, une source de contrats ;
- Clever Cloud Paris/UE comme cible de déploiement ;
- repositories spécialisés générés comme projections à sens unique.

Lire dans cet ordre :

1. [`vision.md`](vision.md)
2. [`docs/decisions/DECISION-REGISTER.md`](docs/decisions/DECISION-REGISTER.md)
3. [`GOALS.md`](GOALS.md) et [`STATUS.md`](STATUS.md)
4. [`docs/adr/0001-bun-fullstack-rust-specialized-big-bang.md`](docs/adr/0001-bun-fullstack-rust-specialized-big-bang.md)
5. [`docs/adr/0002-g1-cross-cutting-product-decisions.md`](docs/adr/0002-g1-cross-cutting-product-decisions.md)
6. [`docs/specifications/SPECIFICATION-STANDARD.md`](docs/specifications/SPECIFICATION-STANDARD.md)
7. [`docs/specifications/DATA-LIFECYCLE.md`](docs/specifications/DATA-LIFECYCLE.md) et [`IDENTITY-AUTHORIZATION.md`](docs/specifications/IDENTITY-AUTHORIZATION.md)
8. [`docs/architecture/TARGET.md`](docs/architecture/TARGET.md)
9. [`docs/transformation/CLEANUP.md`](docs/transformation/CLEANUP.md)
10. [`docs/transformation/BIG-BANG.md`](docs/transformation/BIG-BANG.md)
11. [`docs/transformation/WORKSTREAMS.md`](docs/transformation/WORKSTREAMS.md)
12. [`prompts/`](prompts/) pour l’exécution par phase

## État

Les 18 repositories historiques sont figés et archivés aux SHAs enregistrés dans `ecosystem/LEGACY-MANIFEST.yaml`. G0 est fermé et Specification Lock est en cours. Le monorepo reste en préproduction : aucun produit historique n’est encore reconstruit et aucune disponibilité produit n’est revendiquée.
