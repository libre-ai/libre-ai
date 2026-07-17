# Notebook — plancher de ressources candidat

## Décision

Le **minimum produit candidat**, à prouver avant toute activation des sauvegardes, est :

- macOS arm64 sur une machine de **8 Gio de mémoire physique minimum** et de **8 CPU logiques minimum** ;
- navigateur capable d'exécuter WebAssembly SIMD128, Dedicated Worker, transfert d'`ArrayBuffer`, Web Crypto et IndexedDB ;
- quota de stockage navigateur disponible de **512 Mio minimum**, à vérifier par le futur host produit ;
- budgets Notebook Core inchangés : profil producteur `p95 ≤ 5 s` et RSS additionnel `≤ 256 Mio`, profil maximal `p95 ≤ 10 s` et RSS additionnel `≤ 512 Mio`.

Ce seuil est un **candidat de qualification**, pas encore une promesse de support. Gate B et la release restent rejetées tant qu'une machine physique 8 Gio correspondante et le host produit exact n'ont pas passé leurs matrices. macOS arm64 est la première famille mesurable avec la toolchain actuelle, pas une nécessité fonctionnelle du format : Windows, Linux et x86 restent non supportés tant que leurs propres classes ne sont pas définies et qualifiées.

## Classes matérielles

L'autorité exécutable de qualification est `toolchains/notebook-resource-classes.json`.

| Classe | Mémoire physique | CPU logiques | Rôle | État de preuve |
|---|---:|---:|---|---|
| `desktop-arm64-constrained-8gib` | 8 Gio à moins de 12 Gio | 8 ou plus | minimum produit candidat | en attente de matériel réel |
| `desktop-arm64-mainstream-16gib` | 16 à 24 Gio | 8 ou plus | cible courante | en attente de matériel réel |
| `desktop-arm64-high-memory-reference` | 32 Gio ou plus | 12 ou plus | référence de qualification | qualifiée sur `5190972` |

Les intervalles empêchent une machine M4 Max 36 Gio de se déclarer artificiellement « 8 Gio ». Une simulation, une limitation logicielle de mémoire ou un throttling CPU peuvent servir au diagnostic, mais jamais remplacer la preuve de support d'une classe.

## Pourquoi 8 Gio et 8 CPU

Notebook Core borne le plaintext one-shot à 16 Mio, mais le chemin réel cumule l'entrée ABI, la matrice Argon2id de 64 ou 128 Mio, AES-GCM, Base64/JCS, la mémoire WASM et le host navigateur. La matrice de référence mesure jusqu'à environ 150,5 Mio de mémoire linéaire et impose un budget processus de 256/512 Mio. Un plancher de 8 Gio laisse une marge au navigateur, à IndexedDB et au système sans réduire Argon2id ni le niveau cryptographique.

Huit CPU logiques correspondent aux Mac Apple Silicon d'entrée de gamme réellement disponibles et constituent donc un plancher testable, plutôt qu'une hypothèse à quatre cœurs sans matériel macOS arm64 représentatif. Le budget p95, et non le nombre de cœurs seul, reste l'autorité. Si une machine 8 Gio/4 CPU échoue, le minimum devra être relevé ou le moteur optimisé — jamais les budgets ou paramètres cryptographiques assouplis après mesure.

Le quota candidat de 512 Mio n'est pas une preuve de capacité totale du notebook. Il couvre une marge conservatrice pour le stockage local, une enveloppe maximale d'environ 22,4 Mio et les copies temporaires du futur cycle sauvegarde/restauration. Le harness vérifie que ce quota est disponible sur son origine de qualification, sans y écrire de données ; le cycle IndexedDB réel devra encore être validé dans le host produit.

## Protocole de qualification d'une classe

Sur une machine physique appartenant réellement à la classe :

```sh
export NOTEBOOK_QUALIFICATION_DEVICE_CLASS=desktop-arm64-constrained-8gib
export NOTEBOOK_QUALIFICATION_NODE=/path/to/node-26.5.0/bin/node
export NOTEBOOK_QUALIFICATION_ARCHIVE_DIR=/path/to/verified-archives
export NOTEBOOK_QUALIFICATION_EVIDENCE_MODE=physical-evidence
bun run qualify:notebook-core-v2:performance
```

Pour la classe 16–24 Gio, remplacer l'identifiant par `desktop-arm64-mainstream-16gib`.

Le harness :

1. lit `hw.memsize`, `hw.logicalcpu`, l'architecture et l'OS depuis le host ;
2. refuse toute classe inconnue ou toute machine hors intervalle avant le build et les mesures ;
3. vérifie contexte sécurisé, Worker, transfert d'`ArrayBuffer`, Web Crypto, IndexedDB et au moins 512 Mio de quota disponible ; l'exécution du composant SIMD ferme ensuite la capacité WASM ;
4. exécute deux warm-ups puis 20 seal/open par profil dans Chromium, Firefox et WebKit ;
5. inscrit la classe, ses bornes, les capacités observées et le SHA-256 du manifeste dans chacun des trois rapports ;
6. refuse le résumé si les rapports ne désignent pas la même classe ou le même manifeste.

Une classe ne devient supportée qu'après archivage des rapports bruts sur commit immuable, passe `review-only`, host produit exact et décision Gate B. Les essais utilisent uniquement les fixtures publiques ; aucun service externe ni donnée personnelle n'est nécessaire.

## Diagnostic en machine virtuelle

Une VM macOS arm64 avec 8 ou 16 Gio assignés permet de détecter tôt un dépassement de budget, une panne mémoire ou un problème navigateur. Elle ne reproduit ni la pression mémoire physique, ni le partage de mémoire unifiée, ni les caractéristiques thermiques d'un appareil modeste. Elle ne peut donc pas promouvoir une classe.

Le mode VM est volontairement distinct :

```sh
export NOTEBOOK_QUALIFICATION_DEVICE_CLASS=desktop-arm64-constrained-8gib
export NOTEBOOK_QUALIFICATION_NODE=/path/to/node-26.5.0/bin/node
export NOTEBOOK_QUALIFICATION_ARCHIVE_DIR=/path/to/verified-archives
bun run diagnose:notebook-core-v2:performance:vm
```

Le résumé obtenu porte `evidenceMode: "vm-diagnostic"`, `promotableEvidence: false` et, si les budgets passent, `diagnostic-budgets-pass`. Le validateur refuse les signaux de virtualisation connus en mode `physical-evidence`. L'appel public, les prérequis et le contenu attendu d'une contribution sont détaillés dans [`../../tools/qualification/notebook-core-v2/CONTRIBUTING-DEVICE-QUALIFICATION.md`](../../tools/qualification/notebook-core-v2/CONTRIBUTING-DEVICE-QUALIFICATION.md).

## Matériel encore requis

Pour fermer le plancher, il faut au minimum :

- une machine arm64 macOS physique 8 Gio pour `desktop-arm64-constrained-8gib` ;
- une machine arm64 macOS physique 16 ou 24 Gio pour `desktop-arm64-mainstream-16gib`.

Un MacBook Air Apple Silicon d'entrée de gamme convient comme cible 8 Gio. Une machine locale est préférable ; aucun hyperscaler ou banc de test propriétaire n'est requis. Si un prestataire distant devient indispensable, seules les fixtures publiques peuvent y être exécutées et cette exécution ne vaut pas preuve RGPD d'un futur host contenant des données utilisateur.
