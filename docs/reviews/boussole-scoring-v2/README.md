# Revue agentique indépendante — Boussole scoring v2

Statut : **candidate / NO-GO public scoring**.

La promotion du contrat exige quatre verdicts agentiques, avec des identités/sessions distinctes de l’agent auteur et de l’agent implémenteur :

1. architecture — cohérence WIT/JSON Schema et compatibilité ;
2. sécurité — bornes, refus, arithmétique et imports WASM ;
3. méthodologie — formule, échelle, abstention, absents, pondération et arrondi ;
4. vie privée France/UE — zéro transmission, absence d’identifiant et minimisation des attestations.

Chaque record suit [`../AGENT-REVIEW-PROTOCOL.md`](../AGENT-REVIEW-PROTOCOL.md). Les agents doivent reproduire `contracts/fixtures/boussole-scoring-v2/golden-vectors.v1.json` avec une implémentation indépendante et vérifier les digests exacts.

Ces revues d’ingénierie ne remplacent pas les approbations produit humaines `actorKind = human` liées aux hashes méthode/dataset par les contrats Boussole. Jusqu’aux verdicts agentiques et aux deux approbations produit, toute fonctionnalité de scoring public reste désactivée à la compilation/release.
