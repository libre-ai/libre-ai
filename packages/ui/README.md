# `@libre-ai/design-system`

Small accessible foundation for canonical Bun/React applications: local CSS tokens,
visible focus, semantic surfaces, skip navigation and React Aria action buttons.
It intentionally is not an exhaustive component catalogue. Its bounded `./tailwind` adapter uses
the public Tailwind v4 compiler to emit a deterministic allow-list of utilities.

No font, icon, script or style is loaded from a remote origin. Reduced-motion,
dark-color-scheme and forced-color behavior are CSS-level invariants.
