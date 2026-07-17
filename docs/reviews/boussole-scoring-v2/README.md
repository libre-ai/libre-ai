# Revue agentique indépendante — Boussole scoring v2

Statut : **candidate / NO-GO public scoring**.

Les verdicts historiques restent immuables :

- `METHODOLOGY-VERDICT.md` rejette le corpus initial ;
- `METHODOLOGY-VERDICT-2.md` approuve le corpus méthodologique remédié ;
- `SECURITY-VERDICT.md` rejette l'ancienne frontière de sécurité ;
- le record attribuable sécurité publié sur la PR #39 approuve la remédiation `1f2628f` ;
- les passes attribuables publiées sur l'issue #23 ont ensuite rejeté `1f2628f` en architecture et
  vie privée, tout en approuvant la méthodologie avec réserve mineure.

Le commit immuable `7ad0695b563745d2c6223f4d2cdcafc9fd9e3d0a` remédie ces derniers constats et
reçoit quatre verdicts finaux favorables. Tout verdict antérieur reste une preuve historique mais ne
vaut pas pour ces hashes.

## Verdicts finaux enregistrés

| Rôle | Record durable | Verdict | SHA-256 du rapport |
| --- | --- | --- | --- |
| Architecture | [`ARCHITECTURE-VERDICT.md`](ARCHITECTURE-VERDICT.md) | `APPROVE` | `47a9f615047ea78670634fdf0591331e8e66aae2b476defcb81304ccbb2c56b9` |
| Sécurité | [`SECURITY-VERDICT-2.md`](SECURITY-VERDICT-2.md) | `APPROVE` | `b1371979c3cdc42959919d22bc6cf11689d3a33c5dccb43c9d4f2fd92168264f` |
| Méthodologie | [`METHODOLOGY-VERDICT-3.md`](METHODOLOGY-VERDICT-3.md) | `APPROVE` | `564a9d8afaca637ebbd9415d30bc1cb587a57eb347baba73986b87f6c5760610` |
| Vie privée France/UE | [`PRIVACY-VERDICT.md`](PRIVACY-VERDICT.md) | `APPROVE` | `181df0904924cf66483bab3c3fb556329c873e220790e44218101acf795b0cfb` |

La promotion reste une passe séparée sous
[`../AGENT-REVIEW-PROTOCOL.md`](../AGENT-REVIEW-PROTOCOL.md). Les quatre rôles vérifiés sont :

1. architecture — cohérence WIT/JSON Schema, URN kind-specific et catalogue complet ;
2. sécurité — bornes, refus, arithmétique, publication agrégée et imports WASM ;
3. méthodologie — formule, échelle, abstention, absents, pondération et arrondi ;
4. vie privée France/UE — zéro transmission, agrégation fail-closed et attestations consenties.

Les autorités normatives comprennent les deux corpus explicitement catalogués :

- `contracts/fixtures/boussole-scoring-v2/golden-vectors.v1.json` ;
- `contracts/fixtures/boussole-scoring-v2/security-vectors.v1.json`.

Les passes reproduisent les dix cas méthodologiques avec une seconde implémentation, vérifient les
digests exacts et confirment que les deux reviewers sont opaques, distincts, associés aux rôles
professionnels attendus et liés à des attestations HTTPS hashées avec consentement explicite. Les cas
couvrent la réponse zéro distincte d'un skip, une réponse intermédiaire normalisée par `r/M`, le mode
neutre, les réponses sautées ou absentes, l'agrégation pondérée, les ties-to-even positifs et
négatifs, le dénominateur nul, le reviewer dupliqué et une référence de proposition inconnue.

Le corpus sécurité couvre huit refus byte-exacts, les plafonds exact/+1, les huit codes fermés, les
canaris de non-divulgation, le domaine arithmétique maximal, le seuil minimal d'agrégation et
l'expiration de la revue de publication. Le gate Rust exige un monde WIT résolu sans import.

La politique de publication est hash-bound : seuil déclaré supérieur ou égal à 5, exclusion des
petits groupes, aucune identité individuelle, sources roll-call uniquement agrégées et échéance de
revue explicite. Un dataset réel peut imposer un seuil supérieur ou refuser une source ; il ne peut
jamais relâcher ce plancher contractuel. Les identités professionnelles restent hors payload sous
forme d'attestations publiques consenties et vérifiées par le caller de release, jamais par le
composant pur.

Malgré les quatre verdicts favorables, une passe de promotion séparée et le contrôle humain explicite
restent requis. Toute fonctionnalité de scoring public demeure désactivée à la compilation/release.
