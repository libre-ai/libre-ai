import { containsCredentialMarker, containsSensitivePublicMarker } from "./public-source-scanner";

/**
 * WP-G2-Q01 acceptance criterion 2, the tree-wide "secret" gate: no committed
 * credential (cloud key, VCS/CI token, private key, etc.) appears in a living
 * surface. The credential detection is delegated to containsCredentialMarker
 * (credential-only sibling of the contract PII scanner, same decoding
 * hardening, already covered by public-source-scanner's tests) — this file is
 * only the scope + reporting shell, so the patterns live in exactly one place.
 * Email/URL identifiers are intentionally out of scope here: an example
 * address in a scanner fixture is not a committed credential.
 *
 * Excluded: the detector source (it holds the patterns), this gate's own test
 * and the schema-fixtures vector corpus (both carry anti-pattern fixtures by
 * design, already validated in their own context by check-contracts),
 * historical non-normative review reports under docs/reviews (which contain
 * deliberate hostile examples), and the usual build or vendored trees.
 * Canonical evidence is never excluded: Model Policy evidence additionally
 * uses the personal-data boundary detector because records contain free text.
 */
export interface SecretScanTarget {
  readonly path: string;
  readonly content: string;
}

export interface SecretFinding {
  readonly path: string;
  readonly line: number;
  readonly kind: "credential" | "personal_data";
}

const MODEL_POLICY_EVIDENCE_PREFIX = "distribution/evidence/model-policy/";
const IGNORED_PREFIXES = ["node_modules/", "target/", "dist/", ".git/", "docs/reviews/"];
const IGNORED_SUFFIXES = [
  "public-source-scanner.ts",
  "public-source-scanner.test.ts",
  "check-secret-scan.ts",
  "check-secret-scan.test.ts",
  // Scanner test-vector corpus: intentional credential anti-patterns, exercised
  // as positive detection cases by check-contracts / public-source-scanner.
  "contracts/fixtures/schema-fixtures.v1.json",
];

function isIgnored(path: string): boolean {
  if (IGNORED_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  if (IGNORED_SUFFIXES.some((suffix) => path.endsWith(suffix))) return true;
  return false;
}

export function scanForSecrets(targets: readonly SecretScanTarget[]): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const target of targets) {
    if (isIgnored(target.path)) {
      continue;
    }
    const lines = target.content.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (containsCredentialMarker(line)) {
        findings.push({ path: target.path, line: i + 1, kind: "credential" });
      } else if (
        target.path.startsWith(MODEL_POLICY_EVIDENCE_PREFIX) &&
        containsSensitivePublicMarker(line)
      ) {
        findings.push({ path: target.path, line: i + 1, kind: "personal_data" });
      }
    }
  }
  return findings;
}

if (import.meta.main) {
  const glob = new Bun.Glob("**/*.{ts,tsx,json,jsonc,yaml,yml,toml,md,rs,sql,sh,env}");
  const targets: SecretScanTarget[] = [];
  for await (const path of glob.scan({ cwd: ".", onlyFiles: true, dot: true })) {
    if (isIgnored(path)) {
      continue;
    }
    targets.push({ path, content: await Bun.file(path).text() });
  }
  const findings = scanForSecrets(targets);
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.path}:${finding.line}: committed ${finding.kind} marker`);
    }
    console.error(
      "Secret scan failed (WP-G2-Q01 acceptance 2): a credential or Model Policy evidence personal-data marker was found.",
    );
    process.exit(1);
  }
  console.log("Secret scan clean (WP-G2-Q01 acceptance 2) verified");
}
