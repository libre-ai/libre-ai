# libre-ai/libre-ai — archive du hub

Ce dépôt a été le monorepo de reconstruction de Libre AI. **L'activation
générale multi-repo est en vigueur** (ADR-0020, 2026-07-28) : chaque
contenu vit dans son dépôt de la constellation, et ce dépôt est
l'archive du hub — archivage prononcé par le propriétaire le 2026-07-30
(GO donné par avance, référence : ligne 3.8 du gate-acceptance-log de
`governance`).

## Où est passé le contenu

- **[`ecosystem/migration-index.v1.yaml`](./ecosystem/migration-index.v1.yaml)**
  est la carte complète : chaque chemin migré y porte sa destination, le
  premier commit qui l'a portée et le dernier commit vérifié vert ; le
  commit de retrait s'y ajoute quand le chemin a quitté l'arbre (les
  retraits en cours restent `pending`). Un chemin n'a quitté ce moyeu qu'après
  preuve verte à destination — jamais de fenêtre où un contenu n'existait
  nulle part en vert.
- **[`ecosystem/FORGOTTEN.yaml`](./ecosystem/FORGOTTEN.yaml)** est
  l'inverse : ce qui a été volontairement évincé (I-23), récupérable à
  l'archive, jamais citable comme source vivante.
- La doctrine et l'outillage de flotte vivent dans
  [`libre-ai/governance`](https://github.com/libre-ai/governance) ; les
  contrats canoniques dans
  [`libre-ai/contracts`](https://github.com/libre-ai/contracts) ; l'état
  de chaque projet dans la fiche `project.v1.yaml` de son dépôt, agrégé
  par le [profil de l'organisation](https://github.com/libre-ai).

## Ce que l'archive garantit

L'histoire complète reste clonable ici : les `recoverable_at` du registre
d'oubli et les entrées `history-only` de l'index résolvent dans ce dépôt.
L'évidence acceptée (gates, revues, provenance du toolchain) est immuable
dans l'histoire ; sa projection vivante est publiée par `governance`.
