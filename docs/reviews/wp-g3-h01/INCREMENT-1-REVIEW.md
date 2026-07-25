# WP-G3-H01 incrément 1 — dossier de revue indépendante (K4)

- **Objet :** cœur d'attestation du harness, `crates/agent-harness`
- **Commit revu :** `ecd39e7` (après correction de `74a2b42`)
- **Régime :** premier merge sécurité-critique de la couche 2 — **arrêt dur d'amorçage** (ADR-0011 D4, ADR-0018 D2)
- **Relecteurs :** trois agents indépendants, lancés séparément de l'implémenteur (K4), sur trois lentilles — sécurité adversariale, conformité contractuelle, conformité doctrinale
- **État :** dossier produit, **prononcé propriétaire en attente**. L'implémenteur ne prononce pas.

## Verdicts

| Lentille                 | `74a2b42` | `ecd39e7`                   |
| ------------------------ | --------- | --------------------------- |
| Sécurité adversariale    | REJECT    | **APPROVE-WITH-CONDITIONS** |
| Conformité contractuelle | REJECT    | **APPROVE-WITH-CONDITIONS** |
| Conformité doctrinale    | REJECT    | **APPROVE-WITH-CONDITIONS** |

Les trois premiers verdicts portaient des exploits compilés, pas des opinions. Deux relecteurs ont indépendamment reproduit la même faille.

## Ce que la première passe a trouvé, et qui est fermé

**F1 — le digest ne couvrait pas ce que la vérification restituait.** `HarnessAttestation` dupliquait les deux digests de profil hors du document haché ; `diverged()` et le vérificateur lisaient ces copies. Un confinement dégradé pouvait être réécrit en confinement honoré, digest et signature restant valides — exactement l'attaque que la documentation du module déclarait empêcher.

_Fermé._ Le type ne détient plus qu'un `input` privé, et toutes les valeurs restituées en proviennent. Vérifié par tentative d'écriture, pas par lecture : affectation via l'accesseur refusée (`E0594`), champ privé (`E0616`), et reconstruction impossible sans recalcul du digest.

**F2 — `VerifiedAttestation` était librement constructible** depuis n'importe quel crate, alors que la documentation affirmait le contraire.

_Fermé._ Sept formes de forge tentées depuis un crate externe, sept échecs de compilation. Le point notable : la construction par mise à jour de champs (`..legit`), seul mécanisme qui aurait hérité du témoin d'une instance légitime, est bloquée par `E0451`, qui exige la visibilité de **tous** les champs, témoin compris.

**F3 — la porte de capacité n'existait que sur une entrée sur trois.**

_Fermé._ Elle garde désormais les deux entrées qui accordent. `attestation_digest` reste délibérément ouverte : un vérificateur doit pouvoir hacher un document qu'il s'apprête à refuser, sinon le refus est indémontrable. C'est aussi ce qui rend le vecteur verrouillé reproductible, puisqu'il porte une capacité fermée.

**Divergence contractuelle du préimage.** Le digest portait sur une projection snake_case sans `schemaVersion`, donc irreproductible depuis `contracts/`.

_Fermé, et prouvé par un oracle externe._ Le vecteur `harness-attestation` de `digest-vectors.v1.json` est désormais reproduit. Le relecteur a établi que l'oracle est honnête : le vecteur date de `a619e38` et n'a jamais été modifié, le diff de la branche ne touche aucun fichier de `contracts/`, et **trois implémentations indépendantes convergent** sur la même valeur — `serde_jcs`, le canonicalisateur écrit à la main de `contract-types`, et un `jq -cS | shasum` hors Rust.

**Émission non signée.** La spécification exige le refus à l'émission ; le code émettait un `Option::None` justifié en commentaire.

_Fermé structurellement._ La signature est un `String`, les champs sont privés, l'unique site de construction est atteint après le refus : un objet non signé n'est plus **exprimable**, pas seulement refusé.

## Ce qui reste ouvert

### Bloquant avant tout consommateur

**N1 — `is_media_type` diverge du contrat dans les deux sens.** Il accepte `APPLICATION/OCTET-STREAM` et `application/json/evil`, que le pattern refuse ; il refuse `application/x_thing` et `application/vnd.foo!bar`, que le pattern accepte. Le crate signerait donc une attestation que le registre rejettera en aval, et refuserait des documents légitimes.

**N2 — `is_timestamp` ne valide pas `format: date-time`.** Il accepte `9999-99-99T99:99:99Z`, `0000-00-00T00:00:00Z` et `2026-02-31T25:61:61Z` ; il refuse les fractions de seconde et les offsets, pourtant valides. Le scénario concret : cette valeur traverse la liaison, est hachée, signée et vérifiée ; comme le crate refuse toute dépendance date, un consommateur comparera lexicographiquement, et `9999-99-99…` trie au-dessus de tout instant réel — toute fenêtre de fraîcheur ou anti-rejeu est neutralisée.

Ces deux défauts appartiennent à la classe même sanctionnée au tour précédent — des patterns de contrat approximés à la main — ce qui justifie de les traiter comme bloquants.

### Bloquant pour clore le work-package

**N3 — le crate ne peut ni émettre ni ingérer le document du contrat.** Aucun type ne dérive `Serialize` ni `Deserialize`. Trois conséquences : le critère d'acceptation 4 n'est pas atteint, puisque `verify_binding` ne s'applique qu'à une attestation assemblée dans le même processus, laquelle a déjà passé tous les contrôles qu'il répète ; les trois consommateurs déclarés au catalogue devraient recomposer le JSON à la main ; et cette recomposition est précisément la projection privée divergente qui a causé F1, déplacée chez l'appelant.

**Aggravant, et c'est le finding structurel de cette passe :** `libre-ai-contract-types` **génère déjà** `LibreAiHarnessAttestationV1` depuis le schéma, avec les dix-sept champs et des types qui appliquent les patterns exacts. Le crate ne l'utilise pas et réimplémente ces validations — deux implémentations durables du même domaine, dont l'une est prouvée divergente, ce qu'`AGENTS.md` interdit. C'est aussi la cause commune de N1 et N2.

**Correction recommandée par les relecteurs** : consommer les types générés plutôt que rapiécer les validateurs — ce qui ferme N1, N2 et la duplication ensemble. L'ingestion doit passer par un constructeur faillible exécutant liaison, capacité et recalcul du digest, **jamais** par `Deserialize`, qui rouvrirait F2.

### À traiter en documentation ou dans l'incrément de cérémonie de clé

- **N4** — la liaison `signing_key_id` compare le champ à ce que l'objet signeur _déclare_, pas à la clé qui a produit les octets. Un signeur rejouant une signature d'un autre digest passe. Ce n'est pas une élévation aujourd'hui — cela suppose de contrôler le signeur, donc l'exécution de code dans le processus attestant — mais le commentaire sur-promet et rien ne signalera l'absence du contrôle digest↔signature quand la clé arrivera.
- **N5** — `VerifiedAttestation` abandonne le fait tenant, la clé et le digest ; un consommateur doit relire des champs hors du résultat vérifié, le réflexe même que F1 sanctionnait. Sans danger ici, puisque `input` est intégralement couvert, mais à corriger par hygiène.
- **Codes de refus du profil** — `profile_unresolved`, `profile_digest_mismatch` et `platform_unsupported` appartiennent à l'incrément 1 selon la spécification ; ils ne sont ni implémentés ni nommés comme reste.
- **`effectiveControls`** peut déclarer `network_egress` ou `secret_injection` sans refus : la porte de capacité couvre `networkMode`, pas ce vocabulaire.
- **`CanonicalizationFailed`** est inatteignable et non testé, contre la porte de release « every refusal code reachable by an adversarial test ».
- **Message de commit de `ecd39e7`** : il affirme valider « date-time » et « media type » selon `common.v1`. C'est faux dans les deux sens (N1, N2). À corriger.

## Décisions qui reviennent au propriétaire

1. **`requestedControls`.** La spécification promet « requested and effective controls » en champs distincts et en fait une porte de release ; le contrat verrouillé ne porte pas ce champ et est `additionalProperties: false`. C'est la spécification qui sur-promet. Les relecteurs recommandent d'amender son texte vers « requested and effective _profile digests_ » — que le couple de digests fournit déjà, avec détection de divergence prouvée — plutôt qu'un amendement de contrat, qui contredirait la ligne « n'amende aucun contrat verrouillé » d'ADR-0018.
2. **Les deux refus hors matrice.** `attestation_digest_mismatch` et `canonicalization_failed` n'ont pas d'entrée dans la matrice verrouillée. Le code le signale honnêtement et renvoie à un amendement propriétaire. À trancher : amender la matrice, ou les qualifier d'internes et hors surface publique de refus.
3. **Le profil `date-time`.** Soit accepter les formes RFC 3339 complètes, soit resserrer `common.v1#/$defs/timestamp` au profil Z-only réellement implémenté — ce dernier étant un amendement de contrat.

## Ce que le prononcé peut porter

Les relecteurs convergent : la **retenue** est acquise — aucune capacité au-delà d'ADR-0018 D2, dépendances pures, aucun accès système, aucun `unsafe` — et les trois failles critiques sont fermées de façon structurelle plutôt que conventionnelle. La **preuve**, elle, n'est pas complète : trois des cinq critères d'acceptation restent partiels, et l'un d'eux est irréalisable tant que la spécification n'est pas amendée.

Le prononcé porterait donc sur un demi-incrément 1 correct, non sur WP-G3-H01.

## Gates au commit revu

`cargo test -p libre-ai-agent-harness` 12/12 · `cargo clippy --workspace --all-targets -D warnings` propre · `cargo fmt --check` propre · 35 suites Rust · 1730 tests Bun · `reuse lint` conforme · quatre gardes séparées vertes · zéro `unsafe`.
