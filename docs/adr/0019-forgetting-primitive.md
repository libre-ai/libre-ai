# ADR-0019 — Primitive d'oubli : éviction, registre et garde-fous

- **Statut :** accepted
- **Date :** 2026-07-28
- **Arbitrage :** propriétaire (session du 2026-07-28)
- **Portée :** dépôt socle — contenu documentaire, garde-fous de qualité, chaîne de preuve
- **Lié à :** ADR-0001 (stack web), ADR-0008 §7 (registre exhaustif d'invariants), ADR-0015 (réserve close par cet ADR), ADR-0016 (protocole de revue gaté par hash)

## Contexte

Le dépôt sait oublier de la **doctrine** : `docs/decisions/INVARIANTS.md` est exhaustif
par construction — « ce qui n'y figure pas n'est pas doctrine, quoi qu'affirme un autre
document » (ADR-0008 §7). Il ne sait pas oublier du **contenu**. Un choix mort ne peut
donc pas être formellement retiré : il reste indexé, greppable, lisible par un agent, et
il revient.

Le cas mesuré le 2026-07-28. `docs/transformation/inputs/website/` portait 49 fichiers
de spécification du site, validés le 2026-07-14, dont l'implémentation cible était
Dioxus — retirée de la stack web par ADR-0001 et I-06. Le `README.md` de l'arbre
qualifiait correctement ces documents (« inputs, not locked specifications », « do not
import the Dioxus implementation »), mais les fichiers eux-mêmes portaient
`status: final`, `status: ready-for-dev` et `Status: review`. Ouverts directement — par
`find`, par `grep`, par un agent — ils se présentaient comme des spécifications
courantes. Le marqueur ne voyageait pas avec le fichier. L'arbre n'avait **aucune
référence entrante** dans le dépôt.

Le coût est réel et récurrent : la contamination de contexte fait ressurgir des
décisions abandonnées comme si elles étaient vivantes, et le rattrapage est manuel à
chaque fois.

Un marquage par en-tête a été examiné et écarté : un `status:` corrigé reste greppable.
Le contaminant n'est pas le libellé, c'est la présence dans l'arbre de travail.

## Décision

1. **La primitive d'oubli est l'éviction, pas la destruction.** Le contenu oublié quitte
   l'arbre de travail et reste dans l'historique du dépôt. Ce qui disparaît est le
   vecteur de contamination réel — `grep`, `find`, la lecture opportuniste d'un agent —
   pas l'existence. `git log -S` retrouve le contenu ; personne ne tombe dessus par
   accident.

2. **`ecosystem/FORGOTTEN.yaml` est le registre d'oubli**, pendant de `INVARIANTS.md`
   pour le contenu. Chaque entrée porte ses chemins évincés, son motif, son arbitrage
   propriétaire daté, son commit de récupération et, le cas échéant, sa capture externe
   et ce qui lui survit. Un contenu inscrit au registre est **interdit de citation comme
   source vivante**.

3. **Aucun oubli sans récupérabilité prouvée.** Toute entrée déclare un `recoverable_at`
   qui doit résoudre et porter effectivement les chemins évincés. Le garde-fou le
   vérifie ; une entrée qui ne le prouve pas fait échouer la CI.

4. **Premier lot oublié — 55 fichiers, arbitrage du 2026-07-28 :**
   - `forgotten.website-cdc-bmad` — `docs/transformation/inputs/website/` (49 fichiers).
     Le positionnement encore en vigueur qu'il portait est extrait vers
     `docs/positioning/website.md` ; la section technique morte n'est pas reprise.
   - `forgotten.completed-reconciliation-prompts` — deux comptes rendus de travaux
     terminés posés dans le répertoire des prompts vivants (2 fichiers).
   - `forgotten.legacy-reference-parity` — cartes de parité pré-freeze décrivant des
     interfaces Dioxus (4 fichiers). Ferme la réserve d'ADR-0015 : l'affirmation fausse
     qu'elle signalait ne survit nulle part.

5. **La purge d'historique est écartée**, après examen et sur mesure. Elle aurait réécrit
   450 des 452 commits, invalidé 78 ancrages de commit cités en documentation, exigé la
   réécriture de 15 branches distantes et l'ouverture temporaire de la protection de
   `main` sur un dépôt public. Surtout, elle **n'atteint pas son objectif** : GitHub
   publie 248 `refs/pull/*` que le force push ne touche pas — les pull requests #222 et
   #227 portent chacune les 49 fichiers évincés, et un seul `git fetch origin
'refs/pull/*/head:…'` les restaure. Contre la contamination de contexte, l'éviction
   simple produit exactement le même effet, sans aucun de ces coûts.

6. **Deux garde-fous rendent la primitive opposable**, câblés dans `bun run check` :
   - `check:forgotten` — anti-résurrection (un chemin évincé qui réapparaît),
     anti-citation (un fichier vivant qui le nomme, hors allow-list déclarée dans le
     registre), anti-oubli-sauvage (une entrée sans récupérabilité prouvée) ;
   - `check:anchors` — tout ancrage de commit cité dans un document de doctrine doit
     résoudre, ou être une révision externe gelée déclarée dans
     `ecosystem/LEGACY-MANIFEST.yaml`.

## Portée du garde-fou d'ancrage, et sa limite assumée

`check:anchors` couvre la doctrine — ADR, registres de décisions, `AGENTS.md`,
`STATUS.md`, `GOALS.md`, `vision.md` — et **exclut `docs/reviews/**`**. La politique de
merge du dépôt est le squash : une revue nommée d'après son commit de branche est
ancrée sur un SHA que le squash détruit par construction. 24 ancrages de ce type ne
résolvent déjà plus. Les gater reviendrait à faire échouer la CI contre la politique de
merge, et un gate qui combat la politique finit désactivé. Les revues sont ancrées par
digest de contenu (ADR-0016), que le squash ne touche pas.

Limite documentée du second garde-fou : un SHA court entièrement numérique (ainsi
`6218654` dans `STATUS.md`) est ignoré plutôt que vérifié, faute de pouvoir le
distinguer d'un nombre. Le garde-fou préfère un faux négatif à l'échec d'un document sur
une valeur qui ressemble à de l'hexadécimal.

## Conséquences

- `docs/transformation/inputs/` disparaît ; le workflow `doctrine-governance` perd deux
  exemptions permanentes (`docs/transformation/inputs/`, `docs/parity/legacy-reference/`)
  qui ouvraient un trou dans le contrôle anti-marque-morte. Le gate est strictement plus
  strict qu'avant.
- `tools/quality/check-objectives.ts` n'exige plus les deux prompts de réconciliation ;
  `docs/parity/README.md` enregistre l'oubli des cartes de parité.
- Le job CI `Bun quality` passe en `fetch-depth: 0` : les deux garde-fous sont
  invérifiables en clone superficiel.
- La capture `archives/pre-purge-2026-07-28/` est la **première capture hors dépôt** du
  contenu du site gelé : le dépôt `website` (`0318c92`) était absent des miroirs du
  2026-07-19, de leurs sommes de contrôle et de `org-reorg-2026-07`, ayant été retiré de
  GitHub avant la campagne de capture.
- Risque accepté et consigné : le contenu évincé reste public. Il est joignable par les
  `refs/pull/*` du dépôt, et les forks, clones et caches réalisés depuis le 2026-07-19
  ne sont pas rappelables. L'oubli vise la contamination de contexte, pas la
  dépublication — celle-ci n'est pas atteignable sur ce dépôt.
