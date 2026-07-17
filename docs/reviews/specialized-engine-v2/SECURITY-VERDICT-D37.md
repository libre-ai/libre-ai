# Security verdict — d37f047

- Verdict: `REJECT security`
- Immutable target: `d37f04729cc91249c22f98d7f072ce0f268c116f`
- Review pass: `engine-envelope-d37-security`
- Session: `019f7018-1a87-70c2-9617-0eadc036a5f6`
- Provider/model: `openai-codex/gpt-5.5` (`xhigh`)
- Raw reviewer-output SHA-256: `e5392a6eab984a43fbbd88c008955c4b1009076f9020e41ad5aeecae650fec7d`
- Effect: retained as immutable audit evidence; any subsequent scanner change makes approval evidence stale

## Verbatim reviewer output

Security role review completed in strict review-only mode on clean HEAD.

Target verified:
- HEAD: `d37f04729cc91249c22f98d7f072ce0f268c116f`
- Tree: `57fd1ef945aee7a63431e5e42809e385698b0081`
- Parents: `6459c19a3cf3b716bdd6628e6acd27186d5b7951`, `2325445c896c7cc701210856416db035223760d4`
- Worktree: clean before/after.
- Bun: `1.4.0-canary.1+57f349f63`; `bun run check:toolchain` passed.
- Catalog: exactly one candidate remains: `engine-golden-vectors-v1`.

Reviewed: AGENTS, GOALS, STATUS, decision register, G2 prompt, protocol, catalog, full `docs/reviews/specialized-engine-v2/` dossier including stale approvals/rejects, schema, schema fixtures, generated projection/manifest, strict JSON helper, `check-contracts.ts`, five golden corpora, Radar/Boussole security corpora, and all dedicated vector checkers.

Key hashes:
- `contracts/catalog.v1.json`: `9623562702488b3cd1d3bf5b0d266acb7e4c3ebc204995e55797b3a4356f2a35`
- `contracts/schemas/engine-golden-vectors.v1.schema.json`: `2300274b0ee626ccc01eb3d42142f1dd4bef96aaf8c4c68c0569188caec5954b`
- `contracts/fixtures/schema-fixtures.v1.json`: `fe1f1a274747a2f7393cb4763e23d71d913bf0be883add6cde2d4501af9d7d28`
- `packages/contracts/src/generated/engine-golden-vectors.v1.d.ts`: `47f952ac16bd5c5ac26192cb0da0d5a77bf93c6f412b89801e5d4337ec275816`
- `packages/contracts/src/generated/manifest.json`: `c1def40a03fdb9fafe34c4185249334eee6ffa8fbc6933cfa91932bfa02129da`
- `tools/quality/check-contracts.ts`: `1c421b1e047ffd2e96012fb000b62d67160f61f2c78fbe4b7ac3deefee06f9f4`
- Five corpora: Radar `1e8c0f4…`, Notebook `734eeece…`, Policy v1 `e13033f2…`, Policy v2 `cbb5023c…`, Boussole `f5ac9c7…`.

Checks/probes:
- `bun run check:contracts` passed all shared + dedicated vector checkers.
- Strict JSON probe passed: BOM/invalid UTF-8/duplicate decoded member/unpaired surrogate/non-finite/depth rejected. Probe hash `c475047ae31b5d24320f1489d8bcbedfcd4a440e4abb57716d440a5a11c6bf41`.
- `contractFiles` recomputation: 8/8 Radar files non-symlink, in-repo, hash-matched. Probe hash `3ec1ac4063c59daa3c0feb17b59772c318bc438fb5c80d3d48bd5cbb396d8490`.
- Corpus sensitive scan: only approved Radar canary at `/parseCases/42/baseUrl`; no other email/credential hit. Probe hash `4317688e6e8f7caac791ec04bce46d4a61e5f9e3a0eae2fe60a31246143e9a76`.
- Prior bypass families for mixed amp/numeric/named, semicolonless amp nesting, quoted local-parts, punycode/IP literals, unknown/non-HTML5 entities and max-size performance were probed successfully. Probe hash `99e9bcdcad5e2613ef19233cb9ef7681591b067c0d52d02a2f3c78ef02d06fed`.

Blocking finding:
- `ENGSEC-D37-BLK-001` — `tools/quality/check-contracts.ts:244-296` only decodes a 32-entry punctuation HTML5 entity map, while `containsEmailIdentifier` explicitly supports Unicode local/domain code points via `\p{L}\p{N}` at lines `227` and `387`. Known semicolon-terminated HTML5 Unicode aliases can therefore hide valid Unicode email identifiers in payload values and keys.
- Red probe hash: `d08a34090c7c06c6f2cb1bf6ee1d78a7e6c556ddd7f0fac6feaf47282c8d8ce5`.
- Examples missed by current scanner but decoded by HTML5 reference into direct forms the scanner does detect:
  - `&eacute;&commat;example&period;org` → `é@example.org`
  - `alic&ccedil;&commat;example&period;org` → `alicç@example.org`
  - `alice&commat;ex&aacute;mple&period;org` → `alice@exámple.org`
  - `alice&commat;example&period;&ocy;&rcy;&gcy;` → `alice@example.орг`
  - `alice&commat;example&period;&alpha;&beta;` → `alice@example.αβ`
- Independent alias derivation for single-scalar HTML5 aliases matching supported `\p{L}\p{N}` or email punctuation found 382 supported aliases vs 32 implemented; missing count 350. Derivation hash `340b0e8410c9b401b1793662ff8d3219e58c8233a94899127955f5edd7c399b2`.

Residual risks / scope:
- Existing committed corpora appear synthetic and clean except the approved Radar canary.
- No secret, PII, runtime capability, release, infra, deployment, public scoring, or product engine authorization is present.
- CI/checkers remain evidence only; this role verdict is blocked by the independent Unicode named-entity bypass.

REJECT security — known HTML5 Unicode named entities can encode valid Unicode email identifiers that bypass the shared public-source scanner in payload values and keys.
