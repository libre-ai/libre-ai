# Revue agentique indépendante — Notebook Core v2

Statut : **candidate / NO-GO implémentation crypto**.

La promotion exige quatre verdicts d’agents distincts de l’agent/session auteur et du futur agent implémenteur : architecture, sécurité, cryptographie et vie privée. Chaque record suit [`../AGENT-REVIEW-PROTOCOL.md`](../AGENT-REVIEW-PROTOCOL.md). Le dossier technique normatif est `contracts/wit/notebook-core-v2/SEMANTICS.md` ; les vecteurs publics sont `contracts/fixtures/notebook-core-v2/golden-vectors.v1.json`.

L’agent cryptographie doit reproduire Argon2id, AAD, AES-256-GCM, tag et digest avec une seconde implémentation, puis confirmer les limites navigateur et l’ordre anti-oracle. L’agent vie privée confirme le local-only, l’absence de réseau/log et la portée des métadonnées `id`/`createdAt`. L’artefact WASM final devra avoir une liste d’imports vide.

Une CI verte n’est pas un verdict. Toute auto-revue, identité/session identique à l’auteur ou modification normative après revue maintient la Gate A en attente.
