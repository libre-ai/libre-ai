# Canonical Bun application template

Runnable reference for direct `Bun.serve`, React 19 SSR/document hydration, deterministic static
output, JSON, local assets and an offline static PWA shell. The standalone template refuses Bun
versions below `1.4.0` before build, start and test scripts.

```sh
bun run --cwd distribution/templates/bun-app build
bun run --cwd distribution/templates/bun-app start
bun run --cwd distribution/templates/bun-app test:e2e
```

The template provisions nothing, contains no secret or database, and is not production-qualified
while the Bun stable gate remains blocked.
