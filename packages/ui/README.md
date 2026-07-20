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

Prepared for satellite publication (`publishConfig.access=public`) but **not yet
published**: `private` stays set until the owner reserves the npm `@libre-ai`
scope and authorizes the release (LEXICON §7.4, owner-gated external action).
Until then, consume it as a workspace dependency inside the monorepo.
