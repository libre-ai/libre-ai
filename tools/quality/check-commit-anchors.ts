// Commit-anchor guard (ADR-0019). Doctrine cites commits as proof of arbitration:
// "accepted by human disposition on `6218654`". When such an anchor stops resolving,
// the citation still reads as evidence while pointing at nothing — the quietest way a
// proof chain rots. This guard fails on a doctrine document whose anchor is dangling.
//
// Scope is deliberately doctrine only. `docs/reviews/**` is excluded because the
// repository merges by squash: a review named after its pre-merge branch commit is
// anchored to a SHA that the squash destroys by construction. Gating those paths would
// fight the merge policy rather than protect anything, and a gate that fights policy
// gets disabled. Reviews are anchored by content digest (ADR-0016), which squash does
// not touch.
//
// External frozen revisions are legitimate non-resolving anchors: the archived sibling
// repositories are not in this history. They are allowed when — and only when — they
// are declared in `ecosystem/LEGACY-MANIFEST.yaml`, which already records exactly that.
// The allow-list is therefore existing data, not a new register to keep in sync.

export const DOCTRINE_GLOBS = [
  "docs/adr/*.md",
  "docs/decisions/*.md",
  "AGENTS.md",
  "STATUS.md",
  "GOALS.md",
  "vision.md",
] as const;

/**
 * A short SHA carries at least one `a`-`f`; an all-digit run of the same length is a
 * number (a byte budget, a bit mask), not an anchor. Skipping those costs nothing: a
 * genuinely all-digit prefix is simply not checked, never wrongly failed.
 */
const ANCHOR = /`([0-9a-f]{7,10})`/g;

export function extractAnchors(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(ANCHOR)) {
    const sha = match[1];
    if (sha && /[a-f]/.test(sha)) found.add(sha);
  }
  return [...found];
}

export function parseFrozenRevisions(manifest: string): Set<string> {
  const revisions = new Set<string>();
  for (const match of manifest.matchAll(/^\s*revision:\s*([0-9a-f]{7,40})\s*$/gm)) {
    if (match[1]) revisions.add(match[1]);
  }
  return revisions;
}

export interface DanglingAnchor {
  file: string;
  sha: string;
}

export function findDanglingAnchors(
  files: readonly { path: string; text: string }[],
  resolves: (sha: string) => boolean,
  frozen: ReadonlySet<string>,
): DanglingAnchor[] {
  const frozenList = [...frozen];
  const dangling: DanglingAnchor[] = [];
  for (const file of files) {
    for (const sha of extractAnchors(file.text)) {
      if (resolves(sha)) continue;
      if (frozenList.some((revision) => revision.startsWith(sha))) continue;
      dangling.push({ file: file.path, sha });
    }
  }
  return dangling;
}

if (import.meta.main) {
  const frozen = parseFrozenRevisions(await Bun.file("ecosystem/LEGACY-MANIFEST.yaml").text());

  const paths = new Set<string>();
  for (const pattern of DOCTRINE_GLOBS) {
    const glob = new Bun.Glob(pattern);
    for await (const path of glob.scan({ cwd: ".", onlyFiles: true })) paths.add(path);
  }
  const files = await Promise.all(
    [...paths].sort().map(async (path) => ({ path, text: await Bun.file(path).text() })),
  );

  const resolves = (sha: string) =>
    Bun.spawnSync(["git", "rev-parse", "--verify", "--quiet", `${sha}^{commit}`]).exitCode === 0;

  const dangling = findDanglingAnchors(files, resolves, frozen);
  if (dangling.length > 0) {
    for (const anchor of dangling) {
      console.error(
        `${anchor.file}: commit anchor \`${anchor.sha}\` does not resolve — a citation that reads as evidence but points at nothing (declare it in ecosystem/LEGACY-MANIFEST.yaml if it is a frozen external revision; a shallow clone also fails here)`,
      );
    }
    process.exit(1);
  }

  const total = files.reduce((n, file) => n + extractAnchors(file.text).length, 0);
  console.log(
    `Commit anchors verified: ${total} anchors across ${files.length} doctrine documents resolve, or are declared frozen external revisions`,
  );
}
