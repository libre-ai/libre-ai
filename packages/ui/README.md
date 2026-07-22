# `@libre-ai/ui`

Small accessible foundation for canonical Bun/React applications: local CSS tokens,
visible focus, semantic surfaces, skip navigation and React Aria action buttons.
It intentionally is not an exhaustive component catalogue. Its bounded `./tailwind` adapter uses
the public Tailwind v4 compiler to emit a deterministic allow-list of utilities.

No font, icon, script or style is loaded from a remote origin. Reduced-motion,
dark-color-scheme and forced-color behavior are CSS-level invariants.

## Quickstart

```sh
bun add @libre-ai/ui
```

```tsx
import { SkipLink, StatusMessage, Surface } from "@libre-ai/ui";

export function App() {
  return (
    <>
      <SkipLink targetId="main" />
      <Surface as="main" id="main">
        <StatusMessage politeness="polite">Ready.</StatusMessage>
      </Surface>
    </>
  );
}
```

Import the foundation stylesheet once (`@libre-ai/ui/styles.css`), and use the
bounded Tailwind adapter (`@libre-ai/ui/tailwind`) if you emit utilities at build
time. The three-engine Playwright evidence (SSR + hydration, no-JS, PWA offline,
reduced-motion, security headers) is exercised by the reference chain.

## Publication status

**Publish-ready** (`publishConfig.access=public`): the npm `@libre-ai` scope is
reserved (owner, 2026-07-22) and the `private` guard is lifted; publication is
the owner-run `Release satellites` workflow (LEXICON §7.4 — the release itself
stays an owner-gated external action; see
`docs/transformation/WAVE1-PUBLICATION-RUNBOOK.md`). **Bun-first package:** it
ships TypeScript source (no dist build) — consumers need a TS-aware toolchain
(bun natively; vite/esbuild-based bundlers otherwise).
