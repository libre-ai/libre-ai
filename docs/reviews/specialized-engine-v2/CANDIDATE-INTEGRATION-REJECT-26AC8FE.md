# Candidate-integration rejection — 26ac8fe

- Verdict: `REJECT candidate-integration`
- Immutable target: `26ac8fe8ade91c67fd09dc60a3ad736d2c0c7aa5`
- Review pass: `engine-envelope-post73-integration`
- Session: `019f7025-a4e8-7fe7-b838-e8005c9202fd`
- Provider/model: `openai-codex/gpt-5.5` (`xhigh`)
- Raw reviewer-output SHA-256: `3ad906a736fadcd85ef1cdcbb5b8a7440503f54e2ba0f7b0892dc055caab30ad`
- Effect: retained as immutable audit evidence; any subsequent scanner change makes approval evidence stale

## Verbatim reviewer output

Cible revue en lecture seule : HEAD propre `26ac8fe8ade91c67fd09dc60a3ad736d2c0c7aa5`, base `d37f04729cc91249c22f98d7f072ce0f268c116f`, diff limité à 9 fichiers. Bun épinglé vérifié : `1.4.0-canary.1+57f349f63`.

Findings techniques :
- **Bloquant — faux négatif e-mail avec ponctuation de fin de phrase** : `tools/quality/public-source-scanner.ts:220-264` consomme `.` / `。` / `．` / `｡` comme partie du domaine puis rejette le domaine complet sans backtracking. Résultat : des identifiants privés valides suivis d’une ponctuation passent en valeurs et en clés.
  - Direct probe : `alice@example.org.`, `"alice"@example.org.`, `😀@example.org.`, `alice@[127.0.0.1].`, `alice&commat;example&period;org&period;` → `sensitive=false`.
  - Gate réel muté : contrôle `alice@example.org,` rejeté `rc=1` avec erreur générique ; `alice@example.org.` accepté `rc=0` en valeur et en clé.
  - Probe hash : `/tmp/engine-envelope-direct-probe.out` `0a4fe66894332ed139c2c891d330f2184082375a9433c96331e4b1bea2a647d8`; `/tmp/engine-envelope-gate-mutations.out` `f4b0e5261f05b7dbda3938d3be54ce80b56fe192809cdfc1f8b4e878c089fbbd`.

Constats non bloquants :
- Les anciens rejets/revues du dossier `docs/reviews/specialized-engine-v2/` sont présents et hashés ; le rejet `1523BCD` est conservé (`9f401d8d...`).
- Les cas historiques mixed HTML, named/period, `&at;`, semicolonless, quoted, EAI/Unicode, IDNA/CFWS, domain literals, faux positifs principaux et ressources max ont été rejoués ; hors finding ci-dessus, ils se comportent comme annoncé.
- Pas de drift schéma/corpus/generated/WIT/catalog dans `d37f047..HEAD`; seul candidat catalogue : `engine-golden-vectors-v1`.
- Radar canary reste exact valeur+fichier ; aucune autorisation runtime/data/capability/deployment ajoutée.

`entities@8.0.0` :
- API vérifiée : `decodeHTML(..., DecodingMode.Legacy)` case-sensitive, décode les legacy semicolonless HTML5 (`&quot`, `&ampcommat;`), préserve `&commat` et `&CommaT;`.
- Pin : `package.json:72`, `bun.lock:254` avec intégrité `sha512-zwfz...`; licence `BSD-2-Clause`; zéro dépendance runtime/transitive ; scope dev root seulement.
- Gates : `bun install --frozen-lockfile`, `check:licenses`, `bun audit` OK.
- **Exigence propriétaire séparée** : l’ajout d’une dépendance root + `bun.lock` requiert une acceptation explicite du contrôle dépendances/owner ; les gates ne remplacent pas ce jalon.

Gates exécutées : `check:toolchain`, `check:contracts`, `check:generated-contracts`, `check:licenses`, `bun audit`, `typecheck`, `lint`, `bun test`, `cargo fmt`, tests Rust contract/WIT, `cargo clippy` — verts. Ces résultats restent de l’évidence, pas un verdict.

REJECT candidate-integration — trailing domain punctuation lets private email identifiers bypass the public-source scanner in payload values and keys
