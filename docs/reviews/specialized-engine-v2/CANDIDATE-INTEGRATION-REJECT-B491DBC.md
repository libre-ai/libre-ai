# Candidate-integration rejection — b491dbc

- Verdict: `REJECT candidate-integration`
- Immutable target: `b491dbc1d86d1eb737896a67748b430889bd4612`
- Review pass: `engine-envelope-trailing-punctuation-integration`
- Session: `019f7034-6ebc-7a12-a79d-5797f8a97a2b`
- Provider/model: `openai-codex/gpt-5.5` (`xhigh`)
- Raw reviewer-output SHA-256: `717f003d7a3107a371311e8957306560343a85ed19dcd940e9cb01fe89b31a9d`
- Effect: scan original context before applying the comment-free CFWS projection

## Verbatim reviewer output

Review-only pass completed on clean detached HEAD.

- HEAD verified: `b491dbc1d86d1eb737896a67748b430889bd4612`
- Tree: `b4e055a8046311389dec613234b5940c6ef315c5`
- Parent/base reviewed: `26ac8fe8ade91c67fd09dc60a3ad736d2c0c7aa5`
- Bun pinned/verified: `1.4.0-canary.1+57f349f63`
- Worktree remained clean; clean-state proof SHA-256: `5d439337c9fde526e43c4cd6ce10df280518ac9d77f9815c49458598dbd47923`

Read: protocol, G2 prompt, ADR-0003, full `docs/reviews/specialized-engine-v2/` dossier, and `DEPENDENCY-QUALIFICATION-ENTITIES.md`.

Diff `26ac8fe..HEAD`:
- 8 files, patch SHA-256 `6c88e4fd7a5017a19c8f9a4215ae3694131b916d6bc48300e50605070263b7c5`
- Only code change: `tools/quality/public-source-scanner.ts`
- No `contracts/`, `packages/`, `crates/` drift; no schema/corpus/generated/WIT/catalog drift.
- Sole catalog candidate remains `engine-golden-vectors-v1`.

Blocking finding:
- `tools/quality/public-source-scanner.ts:97-114` removes every parenthesized span as an email comment before scanning, and `containsEmailIdentifier` scans only the stripped result at `tools/quality/public-source-scanner.ts:282-288`.
- This lets private email identifiers in sentence/context punctuation bypass the public-source scanner in both payload values and keys.
- Reproduced accepted by the real gate on temp copies:
  - `Contact (alice@example.org).` value/key → `rc=0`
  - `(alice@example.org)` value/key → `rc=0`
  - `%28alice%40example.org%29` → `rc=0`
  - `&lpar;alice&commat;example&period;org&rpar;` key → `rc=0`
  - nested HTML parenthesized value → `rc=0`
- Direct scanner probe also showed parenthesized dot-atom, quoted, EAI, IDN, IPv4 literal and IPv6 literal all `sensitive=false`.

Trailing punctuation remediation itself was effective in my probes for dot-atom, quoted, EAI, IDN, IPv4/IPv6 literals, ASCII/Unicode terminal dots, percent/HTML/nested forms, and value/key mutations. False-positive controls for leading/internal/double dots, invalid labels, one-letter TLD, handles, FQDN URL/domain-only forms and domain continuations remained representable.

Evidence hashes:
- Parenthesis bypass direct probe: `da509bac3f2260e4b5f06527381d2ff0ff68f9d3d80415e1283c5015b2d44e5c`
- Gate mutation probe: `627720f6e2d177a327b4a06cf2e100cca16c80491cba5d2d35ab96a5fcae3573`
- Complexity probe: `6628a783cc651d27a61039e6c706eb981cad568cac90abf666978514a3bd0084`
- Bun gates log: `06602df646df83bb90c726e44db0d39e0fa7b310e81693bc75fe564f76f02d58`
- Rust targeted gates log: `a22898c305e67e065ec11eb15922c3899080f2ba96ec5f815f439dfc61eceff5f815f439dfc61eceff5`
- Key file hash manifest: `daf917be0989bdca086c53e71eeac8df120427fd0a48563f02dbf2439a1b9224`

Gates run as evidence only, not promotion/role approval:
- `bun run check:toolchain`
- `bun run check:contracts`
- `bun run check:generated-contracts`
- `bun run check:licenses`
- `bun audit`
- `bun test`
- `cargo fmt --all --check`
- `cargo test -p libre-ai-contract-types --test schema_fixtures --locked`
- `cargo test -p libre-ai-ecosystem-engine --test wit_contracts --locked`

`entities@8.0.0` audit:
- Root `devDependency`, exact lock integrity, empty lock dependency object.
- Installed package hash `86e28ac6361377a9c0a82dc7ce849b16bfcc6b13d862c563bbf9b3fe9267773a`; license hash `cb992345949ccd6e8394b2cd6c465f7b897c864f845937dbf64e8997f389e164`.
- BSD-2-Clause; no runtime service/data path; owner approval remains a separate milestone.

REJECT candidate-integration — parenthesized sentence-context email identifiers bypass the public-source scanner in payload values and keys
