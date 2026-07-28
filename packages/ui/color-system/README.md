# Libre AI color-system exploration

This directory contains a non-normative, generated comparison of four color directions and one
convergence candidate. It does not change the published `@libre-ai/ui` color tokens.

## Source and generated artifacts

- `palettes.ts` owns the named directions, OKLCH anchors, risks and evaluation scores.
- `color.ts` owns deterministic OKLCH gamut mapping, sRGB fallbacks, WCAG contrast and
  color-vision screening primitives.
- `system.ts` owns primitive scales, semantic roles, component mappings and visualization ramps.
- `generate.ts` produces the DTCG JSON, CSS, Tailwind CSS 4.3 configuration, audits, reports and
  previews under `generated/`.
- `color-system.test.ts` verifies scale completeness, gamut safety, semantic coverage, critical
  contrast, code/diff readability and categorical screening.
- `generated-assets.test.ts` validates generated tokens against the pinned official DTCG 2025.10
  schema, then verifies audits, Tailwind 4.3 compilation and preview constraints.
- `vendor/` contains that schema and its upstream license notice for deterministic offline checks.

The generated reports are in [`generated/README.md`](./generated/README.md).

## Commands

```sh
bun packages/ui/color-system/generate.ts
bun packages/ui/color-system/generate.ts --check
bun test packages/ui/color-system/*.test.ts
```

## Adoption boundary

Adoption requires an explicit human decision, then a separate implementation change to
`packages/ui/src/styles.css` and its component/browser evidence. Exploration files must not be
imported directly by product components.
