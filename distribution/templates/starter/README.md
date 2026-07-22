# Libre AI Starter Template

Une application de démonstration complète qui illustre les quatre briques fondamentales de Libre AI :

1. **Authentification sécurisée** — SSO via OAuth2/OIDC avec protection CSRF (couche `auth-web`)
2. **Validation de contrats** — Schémas JSON Schema avec rapports d'erreurs structurés (couche `contracts`)
3. **Interface utiliselle résiliente** — Hydratation pariétaire et dégradation sans JS (couche `ui`)
4. **Déploiement souverain** — PWA autonome, cache local, zéro dépendances CDN (couche `web-platform`)

## Ce que vous testiez

Chaque brique est exercée dans ce template :

- **Auth** (`/src/server/index.ts`, `/src/server/handler.ts`)
  - Émetteur DevIssuer : login déterministe → code PKCE → session HTTP-only Strict
  - Routes : `/v1/auth/{login,callback,session}`, `DELETE /v1/auth/session`
  - Tests e2e : `e2e/journal.e2e.ts` (flux complet login/logout)

- **Contracts** (`/src/server/handler.ts`, `POST /api/validate`)
  - Chargement du registre canonique au démarrage
  - Validation JSON document → rapports d'issues structurés
  - Tests e2e : `e2e/journal.e2e.ts` (playground de validation)

- **UI** (`/src/ui/journal-app.tsx`, `/src/shared/document.tsx`)
  - Hydratation pariétaire (SSR identique au premier rendu client)
  - Dégradation gracieuse sans JS (label + erreur visible)
  - `lai-enhanced-only` pour les contrôles JS-dépendants
  - Tests e2e : `e2e/no-js.e2e.ts` (baseline sans JS)

- **Web-platform** (assets, PWA, SSR)
  - Service worker + cache shell (offline-first)
  - Manifest `display: standalone`
  - Document statique rendu à la génération
  - Tests e2e : `e2e/pwa.e2e.ts` (manifest, SW, offline)

## Démarrage rapide

### Prérequis

- **Bun >= 1.4.0** uniquement (pas npm/yarn/pnpm)

### Installation et test

```bash
bun install
bun run build        # Génère /dist (assets, manifest, SW)
bun run start        # Lance le serveur http://127.0.0.1:3000
```

#### Mode développement (une autre fenêtre terminal)

```bash
bun run test         # Tests unitaires (domain + UI)
bun run test:e2e     # Tests Playwright (chromium/firefox/webkit)
```

**Sortie e2e attendue** (tous les moteurs) :

```
✓ no-js.e2e.ts
  ✓ page is usable without JavaScript

✓ pwa.e2e.ts
  ✓ PWA manifest is correctly served
  ✓ service worker is registered and caches the shell
  ✓ PWA cached shell serves offline

✓ journal.e2e.ts
  ✓ full authentication flow: login and logout (chromium, firefox, webkit)
  ✓ add a note and verify it appears in the list (chromium, firefox, webkit)
  ✓ domain refusal: empty note text is rejected with error message (chromium, firefox, webkit)
  ✓ contracts playground: validate document against schema (chromium, firefox, webkit)
  ✓ full multi-step journal workflow (cross-browser) (chromium, firefox, webkit)

✓ csrf.e2e.ts
  ✓ POST /api/notes without CSRF token is rejected with 403
  ✓ POST /api/notes with valid CSRF token succeeds
```

## Architecture

```
src/
├── server/
│   ├── index.ts          # Écoute HTTP, wiring auth-boundary (dev-only)
│   └── handler.ts        # Endpoints (SSR, auth, notes, validation, CSRF)
├── client/
│   └── app.tsx           # Client bundle (hydration, interactions)
├── ui/
│   └── journal-app.tsx   # Composant React (journal + playground)
├── domain/
│   └── journal.ts        # Logique métier + tests (addNote, listNotes, refusal)
└── shared/
    └── document.tsx      # Document descriptor (title, lang, stylesheets, manifest)

dist/
├── assets/               # Client JS + CSS (générés)
├── static/index.html     # Document SSR (généré)
├── manifest.webmanifest  # PWA manifest (généré)
└── sw.js                 # Service worker (généré)

e2e/
├── no-js.e2e.ts          # Baseline sans JS
├── pwa.e2e.ts            # Manifest, SW, offline
├── journal.e2e.ts        # Flux complet (multi-moteur)
└── csrf.e2e.ts           # CSRF POST protection
```

## Authentification de démonstration

⚠️ **La connexion utilise un émetteur local déterministe (`DevIssuer`).** Jamais en production.

- Sujet : `dev-user-1`
- User ID : `usr_${"b".repeat(16)}`
- Tenant ID : `ten_${"a".repeat(16)}`
- Signature : HMAC-SHA256 (clé en mémoire)
- Session : HTTP-only + Strict SameSite + 30 min idle (expiration absolue : 24 h)

Endpoint d'autorisation : `GET /authorize?code_challenge=...&nonce=...&state=...`
→ Émet un code OAuth2 déterministe → Redirige vers `/v1/auth/callback?code=...`

## Structure des tests e2e

### no-js.e2e.ts

- Vérifie le titre et la notice d'émetteur local
- Vérifie l'absence de `data-hydrated` (SSR sans JS)
- Vérifie que les contrôles enhanced-only sont inaccessibles

### pwa.e2e.ts

- Manifest JSON (content-type, champs requis)
- Service worker enregistré + cache shell
- Offline reload : assets servis depuis le cache

### journal.e2e.ts (chromium + firefox + webkit)

- **Login complet** : POST `/v1/auth/login` → GET `/authorize` (DevIssuer) → `/v1/auth/callback` → session
- **Authenticated state** : GET `/api/session` (userId, tenantId)
- **Add note** : POST `/api/notes` (CSRF-protected) → apparition dans la liste
- **Refusal** : note vide → erreur aria-live, liste inchangée
- **Validation** : playground de contrats (schéma select + JSON input)
- **Logout** : DELETE `/v1/auth/session` → redirection / + unauthenticated state
- **Cross-browser** : même workflow sur 3 moteurs (parity assertion)

### csrf.e2e.ts

- POST `/api/notes` sans header `X-CSRF-Token` → 403 `auth.csrf_invalid`
- POST `/api/notes` avec token valide → 201 `{ ok: true }`

## Notes d'implémentation

### Bun uniquement

Ce template utilise **Bun** (CLI, build, test, runtime). Pas de fallback npm/yarn/pnpm — c'est un choix de souveraineté : un seul moteur d'exécution.

### Server start

`bun src/server/index.ts` démarre un serveur Bun natif (pas de wrapper Express/Hono). Les imports `@libre-ai/*` résolvent les packages du monorepo via `workspace:*`.

### Build

`bun scripts/build.ts` (TypeScript à la frappe) :

- Compile le client via `Bun.build()`
- Génère les CSS (foundation + utilities Tailwind)
- Render le document statique SSR
- Génère manifest + service worker avec hashes de cache

### Domain tests

`bun test` exécute les tests unitaires de domaine (`src/domain/*.test.ts`). Aucune mutation d'état, résultats purs.

### E2E isolation

`playwright.config.ts` exécute les tests en parallèle (fullyParallel: true, reuseExistingServer: false). Chaque test reçoit une page vierge et une session server isolée.

## Critique du template

Ce template n'est pas une application prête pour la production. Il démontre les briques, pas une UX complète :

- Pas de client-side routing (navigation côté client)
- Pas de persistance (session journaux en mémoire)
- Pas de limite de débit ou quota
- Pas de audit logging (RGPD, provenance)
- Aucune gestion d'erreur d'edge-case
- Pas de analytics ou observabilité

**Objet** : apprendre où chaque brique vit, comment elles s'assemblent, et en quoi chacune peut être remplacée.

## Prochaines étapes

### Pour apprendre

1. Modifiez `src/domain/journal.ts` (logique métier) → relancez `bun test`
2. Modifiez `src/ui/journal-app.tsx` (UI) → relancez `bun run test:e2e`
3. Ajoutez une route en `/src/server/handler.ts` → vérifiez avec `curl` local puis e2e

### Pour déployer

1. Remplacez l'émetteur `DevIssuer` par un vrai (Keycloak, Auth0, etc.) en `index.ts`
2. Remplacez l'`InMemorySessionStore` par une vraie DB
3. Remplacez les CSRF tokens manuels par une vraie vérification (boundary les gère déjà)
4. Déployez le `/dist` build sur un CDN (static assets) + le serveur sur un compute

### Pour ajouter une brique

1. Identifiez la couche (`contracts`, `auth-web`, `ui`, `web-platform`)
2. Lisez le **contrat public** de ce package (`src/index.ts`)
3. Écrivez un test pour le nouveau comportement
4. Intégrez dans `handler.ts` ou `journal-app.tsx`
5. Vérifiez les e2e : `bun run test:e2e`

## Licence

Apache 2.0 (voir LICENSE)
