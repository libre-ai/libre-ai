import { describe, expect, test } from "bun:test";

import { $ } from "bun";

/**
 * Every deny-list motif of the doctrine-governance workflow must match at
 * least once in the tracked Markdown corpus, exclusions NOT applied — a
 * motif that matches nothing anywhere is inert: it was derived from a
 * paraphrase instead of the text it is supposed to forbid, and the gate it
 * feeds is green on nothing.
 *
 * Origin: K4 review of ADR-0020 (2026-07-28) found two such inert motifs —
 * one broken by a bold marker inside the original sentence, one citing a
 * paraphrase invented by the superseding act. Both were fixed by re-deriving
 * the motif from the origin text; this guard makes the class structurally
 * impossible for every future extension of the list.
 */

const WORKFLOW_PATH = ".github/workflows/doctrine-governance.yml";

/** Split a grep -E pattern on top-level `|` only (never inside a group). */
export function splitTopLevelAlternatives(pattern: string): string[] {
  const alternatives: string[] = [];
  let depth = 0;
  let current = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "\\") {
      current += char + (pattern[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "|" && depth === 0) {
      alternatives.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  alternatives.push(current);
  return alternatives;
}

export function countMatches(pattern: string, corpus: readonly string[], flags = ""): number {
  const regex = new RegExp(pattern, flags);
  let count = 0;
  for (const text of corpus) {
    if (regex.test(text)) count += 1;
  }
  return count;
}

async function loadWorkflow(): Promise<string> {
  return await Bun.file(WORKFLOW_PATH).text();
}

function extractPattern(workflow: string, marker: RegExp): string {
  const match = workflow.match(marker);
  if (!match?.[1]) {
    throw new Error(`doctrine-governance workflow: deny-list pattern not found (${marker})`);
  }
  return match[1];
}

async function loadTrackedMarkdown(): Promise<string[]> {
  const paths = (await $`git ls-files -- "*.md"`.text()).trim().split("\n").filter(Boolean);
  return Promise.all(paths.map((path) => Bun.file(path).text()));
}

describe("splitTopLevelAlternatives", () => {
  test("splits on top-level pipes only, keeping groups and escapes intact", () => {
    expect(splitTopLevelAlternatives("a|b(c|d)e|f\\|g")).toEqual(["a", "b(c|d)e", "f\\|g"]);
  });
});

describe("countMatches", () => {
  test("counter-proof: an invented motif matches nothing, which the guard must flag", () => {
    expect(countMatches("xyzzy-motif-inerte", ["some corpus", "other text"])).toBe(0);
  });
});

describe("doctrine-governance deny-list effectiveness", () => {
  test("every superseded-doctrine motif matches at least one tracked Markdown file", async () => {
    // Only the `superseded` family carries the effectiveness requirement:
    // those motifs are derived from origin texts that still live in the tree
    // (excluded ADRs, LEXICON, the bannered sequencing document). The
    // `preventive` family (banned brands/domains) legitimately matches
    // nothing once the purge is complete.
    const workflow = await loadWorkflow();
    const pattern = extractPattern(workflow, /\bsuperseded="([^"]+)"/);
    const corpus = await loadTrackedMarkdown();
    const inert = splitTopLevelAlternatives(pattern).filter(
      (alternative) => countMatches(alternative, corpus) === 0,
    );
    expect(
      inert,
      `Inert deny-list motifs (match nothing in any tracked .md, exclusions not applied): ${inert.join(" ⏐ ")} — re-derive each from the origin text it is supposed to forbid.`,
    ).toEqual([]);
  });

  test("both deny-list families exist and every motif compiles as a regex", async () => {
    const workflow = await loadWorkflow();
    const superseded = extractPattern(workflow, /\bsuperseded="([^"]+)"/);
    const preventive = extractPattern(workflow, /\bpreventive="([^"]+)"/);
    for (const alternative of [
      ...splitTopLevelAlternatives(superseded),
      ...splitTopLevelAlternatives(preventive),
    ]) {
      expect(() => new RegExp(alternative)).not.toThrow();
      expect(alternative.trim().length).toBeGreaterThan(0);
    }
  });

  test("every retired-brand motif matches at least one tracked Markdown file", async () => {
    const workflow = await loadWorkflow();
    // The retired-brands grep is the single-quoted -iE pattern of the
    // LEXICON §6.3 step.
    const pattern = extractPattern(workflow, /matches=\$\(grep -rniE '([^']+)'/);
    const corpus = await loadTrackedMarkdown();
    const inert = splitTopLevelAlternatives(pattern).filter(
      (alternative) => countMatches(alternative, corpus, "i") === 0,
    );
    expect(
      inert,
      `Inert retired-brand motifs (match nothing in any tracked .md): ${inert.join(" ⏐ ")} — the historical registers the LEXICON lists must carry each name at least once.`,
    ).toEqual([]);
  });
});
