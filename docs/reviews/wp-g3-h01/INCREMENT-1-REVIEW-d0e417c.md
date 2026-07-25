# WP-G3-H01 incrément 1 — dossier de revue à `d0e417c`

- **Objet :** cœur d'attestation du harness, `crates/agent-harness`
- **Commit visé :** `d0e417c`
- **Régime :** premier merge sécurité-critique de la couche 2 — arrêt dur d'amorçage (ADR-0011 D4, ADR-0018 D2)
- **Complète, sans le remplacer :** `INCREMENT-1-REVIEW.md` (visant `ecd39e7`), immuable au sens du protocole
- **État :** **le prononcé n'est pas régulier en l'état.** Voir « Ce qui manque » ci-dessous.

## Avertissement de validité — à lire avant toute décision

`AGENT-REVIEW-PROTOCOL.md` exige qu'une revue vise un commit immuable, et qu'une modification normative postérieure à un verdict périme l'approbation concernée et impose une nouvelle passe.

**Aucune passe indépendante ne couvre `d0e417c`.** Les douze verdicts consignés ici visent quatre commits antérieurs, et deux commits normatifs les séparent du commit visé. Ce dossier est donc un **enregistrement d'audit**, pas une autorisation : il consigne l'historique, les arbitrages propriétaires et l'état mesuré, et il nomme ce qui manque pour qu'un prononcé soit régulier.

Il porte aussi une fonction que le dépôt n'assurait pas : les arbitrages propriétaires du 2026-07-25 n'existaient jusqu'ici que dans des messages de commit et des échanges de session, alors qu'un document sous Specification Lock les cite déjà (`docs/apps/harness.md` renvoie à « A-1 »). Le protocole veut cette évidence durable dans le dossier.

## Hashes des autorités au commit visé

| Autorité                                                           | SHA-256 (16 premiers) |
| ------------------------------------------------------------------ | --------------------- |
| `contracts/schemas/harness-attestation.v1.schema.json`             | `ce65dae99a54ed61`    |
| `contracts/schemas/harness-profile.v1.schema.json`                 | `04e0e29d593b329f`    |
| `contracts/schemas/common.v1.schema.json`                          | `2b96e658dc88c811`    |
| `contracts/fixtures/agent-orchestration-v1/digest-vectors.v1.json` | `dcd22bc7c06ec876`    |
| `contracts/agent-orchestration/SEMANTICS.md`                       | `83a935f201c9d02c`    |

`contracts/` est resté intact sur toute la branche (`git diff 4aa4ec9..d0e417c -- contracts/` vide) : aucun vecteur n'a été ajusté à l'implémentation.

## Verdicts consignés, par commit et par rôle

| Commit        | Sécurité adversariale   | Conformité contractuelle | Conformité doctrinale   |
| ------------- | ----------------------- | ------------------------ | ----------------------- |
| `74a2b42`     | reject                  | reject                   | reject                  |
| `ecd39e7`     | approve-with-conditions | approve-with-conditions  | approve-with-conditions |
| `dec6429`     | reject                  | reject                   | reject                  |
| `0b509fb`     | reject                  | reject                   | approve-with-conditions |
| **`d0e417c`** | **non revu**            | **non revu**             | **non revu**            |

Douze passes, trois rôles, quatre commits. Les relecteurs ont travaillé hors du dépôt, sur des crates externes liant celui-ci par chemin ; le dépôt est resté propre à chaque passe.

## Ce que les revues ont trouvé, et ce que cela a coûté

Le fait saillant de ce cycle n'est pas la liste des défauts : c'est que **chacune des trois corrections a introduit le défaut trouvé au tour suivant**, et toujours sur le même champ — `generatedAt`, le seul que le contrat ne sait pas générer.

**Tour 1 (`74a2b42`) — trois critiques, deux exploits compilés indépendamment.** Les digests de profil étaient dupliqués hors du document haché, si bien qu'un confinement dégradé pouvait être réécrit en confinement honoré sans invalider ni digest ni signature. `VerifiedAttestation` était librement constructible alors que sa documentation affirmait le contraire. La porte de capacité ne gardait qu'une entrée sur trois. S'y ajoutait un préimage snake_case sans `schemaVersion`, donc un digest irreproductible depuis `contracts/` — alors qu'un vecteur verrouillé existait et n'avait pas été cherché.

**Tour 2 (`ecd39e7`) — conditions.** Les trois critiques fermées, mais les validateurs écrits à la main divergeaient du contrat dans les deux sens, et rien n'émettait le document contractuel alors que `contract-types` générait déjà le type dupliqué.

**Tour 3 (`dec6429`) — régression introduite par la correction.** En ajoutant l'émission, `to_contract_document` re-sérialisait `generatedAt` tandis que le digest hachait la chaîne brute : six entrées distinctes produisaient un document unique et six digests. Les deux tests neufs ne se croisaient jamais, et toutes les fixtures du dépôt utilisaient la seule forme qui fonctionnait.

**Tour 4 (`0b509fb`) — violation d'une règle normative.** Typer le champ fermait la régression mais installait précisément ce que `SEMANTICS.md` interdit pour ce contrat : parser puis re-sérialiser silencieusement. Le typage avait aussi supprimé le seul site où une borne d'année pouvait vivre, si bien qu'un instant à huit mille ans était signé et émis alors que le registre le refusait.

**Correction appliquée en `d0e417c`.** Rejeter le non-canonique plutôt que le normaliser — l'option que le tour 3 avait proposée et que je n'avais pas retenue. Sur l'ensemble ainsi accepté la normalisation est identitaire, donc les octets reçus, hachés et émis coïncident ; et le refus satisfait la sémantique. Les deux tests sont croisés ; seize formes non canoniques sont refusées nommément, dont le témoin du tour 3 et les années hors bornes.

## Arbitrages propriétaires du 2026-07-25 — évidence durable

Rendus en session après le dossier `ecd39e7`, et cités depuis par la spécification.

| Réf     | Question                                                                                                                                                                                      | Décision                                                          | Conséquence                                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A-1** | La spécification promettait des « requested and effective **controls** » distincts, que le contrat verrouillé ne peut pas porter (`additionalProperties: false`, un seul `effectiveControls`) | Amender le **texte de la spécification** vers « profile digests » | Aucun contrat touché. Le profil étant content-addressed, `requestedProfileDigest` le résout — comparaison différée au résolveur, nommée comme telle |
| **B-1** | Deux refus du code n'avaient pas d'entrée dans la matrice verrouillée                                                                                                                         | Amender la matrice pour les deux                                  | Quinze codes ; `canonicalization_failed` marqué défensif et exempté de la porte d'atteignabilité                                                    |
| **C-1** | `format: date-time` était approximé à la main                                                                                                                                                 | Aligner sur RFC 3339                                              | Corrigé au tour 4 : aligner l'**acceptation** ne suffisait pas, il fallait rejeter le non-canonique                                                 |
| **D-1** | Validateurs écrits à la main vs types générés par `contract-types`                                                                                                                            | Consommer les types générés                                       | Ferme la duplication ; `generatedAt` reste l'exception, faute de newtype généré                                                                     |

Option écartée en connaissance de cause : resserrer `common.v1#/$defs/timestamp` au profil Z-only. **41 schémas** le référencent — un défaut de ce crate n'engage pas le portefeuille.

## État mesuré à `d0e417c`

**Acquis, vérifié par des harnais externes :** la retenue — aucune capacité au-delà d'ADR-0018 D2, pas d'accès système, `chrono` sans feature `clock`, aucun client réseau, `#![forbid(unsafe_code)]`. La non-forgeabilité — sept formes de construction tentées depuis un crate externe, sept refus du compilateur, la construction par mise à jour de champs étant bloquée par `E0451`. La reproductibilité — le vecteur verrouillé recalculé par trois implémentations indépendantes.

**Ouvert et nommé dans le code même :** quatre refus de la matrice sur quinze sont implémentés, un est défensif, **dix sont différés** et listés dans la documentation du module. `effectiveControls` accepte `network_egress` sans refus, faute de vocabulaire verrouillé. Le lien entre digest et signature relève de la cérémonie de clé. Aucun chemin d'ingestion n'existe.

**Critères d'acceptation de WP-G3-H01 : un atteint sur cinq**, un matériellement avancé — un opérateur peut désormais recalculer le digest depuis le document publié —, trois non atteints.

**Gates :** `cargo test -p libre-ai-agent-harness` 18/18 · `cargo test --workspace` 35 suites · `cargo clippy --workspace --all-targets -D warnings` propre · `cargo fmt --check` propre · `bun run check` 1730 tests · Specification Lock 13 · work-packages 29 · `reuse lint` conforme · quatre gardes séparées vertes.

## Ce qui manque pour un prononcé régulier

1. **Une passe indépendante visant `d0e417c`**, dans les trois rôles, avec `reviewPassId` et enveloppe de verdict. Sans elle, le prononcé porterait sur un commit qu'aucune revue ne couvre, l'approbation de `0b509fb` étant périmée par deux commits normatifs.
2. **Un arbitrage sur ce que le prononcé recouvre.** Les relecteurs convergent : la retenue est établie, la preuve ne l'est pas. Prononcer sur l'incrément entier reviendrait à valider quatre critères d'acceptation qui ne sont pas atteints.

## Réserve de méthode

Le taux de découverte n'a pas décru sur quatre tours, et le seul point que je tiendrais aujourd'hui pour solide est celui où je me suis trompé trois fois de suite. Rien n'établit qu'une cinquième passe serait vide. Cette réserve appartient au dossier : elle est ce qu'un prononcé doit peser, au même titre que les gates vertes.
