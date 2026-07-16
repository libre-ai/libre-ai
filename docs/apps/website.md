# Website

- **Path:** `apps/website`
- **Purpose:** public projection of Libre AI knowledge, products and evidence.
- **Runtime:** Bun/React SSR plus deterministic static output.
- **Owns:** rendering, navigation, search integration, feeds, sitemap and accessibility.
- **Does not own:** product truth or maturity claims; these come from Knowledge Objects.
- **Data:** public compiled corpus; no account or behavioral tracking.
- **Critical gates:** static reproducibility, Pagefind, CSP, no remote assets, Playwright 3 engines, Clever deployment.
