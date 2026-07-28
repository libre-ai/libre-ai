import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkProductPhaseFiles,
  DEFAULT_REPO_ROOT,
  extractGateIds,
  isAllowedEvidenceRecordPath,
  type ProductPhaseRoadmap,
  replaceReadmeProjection,
  validateRoadmapSemantics,
} from "./check-product-phases";

const temporaryDirectories: string[] = [];

function validRoadmap(): ProductPhaseRoadmap {
  return {
    schemaVersion: "libre-ai.model-policy-phases.v1",
    documentStatus: "draft",
    statusAuthorities: { program: "GOALS.md", execution: "STATUS.md" },
    updatedAt: "2026-07-28T00:00:00Z",
    phases: [
      {
        id: "MP-P0",
        title: "Foundation",
        outcome: "Establish the deterministic authority boundary.",
        document: "docs/apps/model-policy/phases/00-foundation.md",
        dependsOn: [],
        activationPrerequisites: ["Owner selection is recorded by GOALS.md"],
        gates: [
          {
            id: "MP-P0-G01",
            requiredEvidenceLevel: "qualified",
            evidence: [],
          },
          {
            id: "MP-P0-G02",
            requiredEvidenceLevel: "verified",
            evidence: [],
          },
        ],
      },
      {
        id: "MP-P1",
        title: "Deterministic tunnel",
        outcome: "Qualify a use case without an LLM.",
        document: "docs/apps/model-policy/phases/01-deterministic-qualification.md",
        dependsOn: ["MP-P0"],
        activationPrerequisites: ["MP-P0 evidence is owner-accepted"],
        gates: [
          {
            id: "MP-P1-G01",
            requiredEvidenceLevel: "qualified",
            evidence: [],
          },
        ],
      },
    ],
  };
}

async function runGit(repoRoot: string, args: string[]): Promise<void> {
  const process = Bun.spawn(["git", ...args], {
    cwd: repoRoot,
    stdout: "ignore",
    stderr: "pipe",
  });
  const stderr = await new Response(process.stderr).text();
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
}

async function createFixture(
  roadmap: unknown,
  firstPhaseDocument = [
    "# MP-P0 — Foundation",
    "",
    "### MP-P0-G01 — First gate",
    "",
    "### MP-P0-G02 — Second gate",
    "",
  ].join("\n"),
): Promise<string> {
  const repoRoot = await mkdtemp(join(tmpdir(), "model-policy-phases-"));
  temporaryDirectories.push(repoRoot);
  const directories = [
    "apps/model-policy",
    "docs/apps/model-policy/phases",
    "docs/apps/model-policy",
  ];
  for (const directory of directories) await mkdir(join(repoRoot, directory), { recursive: true });

  const sourceFiles = [
    "docs/apps/model-policy/phases.v1.schema.json",
    "docs/apps/model-policy/evidence-record.v1.schema.json",
  ];
  for (const sourceFile of sourceFiles) {
    await writeFile(
      join(repoRoot, sourceFile),
      await Bun.file(join(DEFAULT_REPO_ROOT, sourceFile)).text(),
    );
  }
  await writeFile(
    join(repoRoot, "docs/apps/model-policy/phases.v1.json"),
    `${JSON.stringify(roadmap, null, 2)}\n`,
  );
  await writeFile(
    join(repoRoot, "docs/apps/model-policy/phases/00-foundation.md"),
    firstPhaseDocument,
  );
  await writeFile(
    join(repoRoot, "docs/apps/model-policy/phases/01-deterministic-qualification.md"),
    "# MP-P1 — Tunnel\n\n### MP-P1-G01 — Gate\n",
  );
  await writeFile(
    join(repoRoot, "apps/model-policy/README.md"),
    "# App\n\n<!-- model-policy-phases:start -->\nstale\n<!-- model-policy-phases:end -->\n",
  );
  await writeFile(
    join(repoRoot, "docs/apps/model-policy/README.md"),
    "# Plan\n\n<!-- model-policy-plan:start -->\nstale\n<!-- model-policy-plan:end -->\n",
  );
  await runGit(repoRoot, ["init", "-q"]);
  await runGit(repoRoot, ["add", "."]);
  return repoRoot;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("validateRoadmapSemantics", () => {
  test("accepts an acyclic planning-only phase record", () => {
    expect(validateRoadmapSemantics(validRoadmap())).toEqual([]);
  });

  test("rejects duplicate evidence records", () => {
    const roadmap = validRoadmap();
    const gate = roadmap.phases[0]?.gates[0];
    if (gate) {
      const reference = {
        record: "distribution/evidence/model-policy/p0-g01.json",
        sha256: `sha256:${"a".repeat(64)}`,
      };
      gate.evidence.push(reference, reference);
    }
    expect(validateRoadmapSemantics(roadmap)).toContain("MP-P0-G01: duplicate evidence record");
  });

  test("rejects dependency cycles", () => {
    const roadmap = validRoadmap();
    const first = roadmap.phases[0];
    if (first) first.dependsOn.push("MP-P1");
    expect(validateRoadmapSemantics(roadmap)).toContain("MP-P0: dependency cycle");
  });
});

describe("gate and path parsing", () => {
  test("extracts only exact gate headings in document order", () => {
    const document = [
      "### MP-P0-G01 — First",
      "### MP-P0-G02 - Wrong separator",
      "### MP-P0-G03 — Third",
    ].join("\n");
    expect(extractGateIds(document)).toEqual(["MP-P0-G01", "MP-P0-G03"]);
  });

  test("allows only canonical JSON evidence records", () => {
    expect(isAllowedEvidenceRecordPath("distribution/evidence/model-policy/p0-g01.json")).toBe(
      true,
    );
    expect(isAllowedEvidenceRecordPath("package.json")).toBe(false);
    expect(isAllowedEvidenceRecordPath("docs/reviews/report.md")).toBe(false);
  });
});

describe("replaceReadmeProjection", () => {
  test("replaces exactly one bounded generated section", () => {
    const source = [
      "# Product",
      "",
      "<!-- model-policy-phases:start -->",
      "old",
      "<!-- model-policy-phases:end -->",
      "",
    ].join("\n");
    const result = replaceReadmeProjection(source, "new");
    expect(result).toContain(
      "<!-- model-policy-phases:start -->\nnew\n<!-- model-policy-phases:end -->",
    );
    expect(result.startsWith("# Product")).toBe(true);
  });

  test("refuses missing markers rather than appending a second projection", () => {
    expect(() => replaceReadmeProjection("# Product\n", "new")).toThrow(
      "README phase projection markers must occur exactly once",
    );
  });
});

describe("checkProductPhaseFiles", () => {
  test("returns stable schema diagnostics instead of running semantics on malformed input", async () => {
    const repoRoot = await createFixture({ phases: null });
    const failures = await checkProductPhaseFiles({ repoRoot });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toStartWith("Model Policy phase schema rejected:");
    expect(failures[0]).not.toContain("TypeError");
  });

  test("does not write projections after a gate-definition failure", async () => {
    const repoRoot = await createFixture(
      validRoadmap(),
      "# MP-P0 — Foundation\n\n### MP-P0-G01 — First gate\n### MP-P0-G99 — Extra gate\n",
    );
    const readmePath = join(repoRoot, "apps/model-policy/README.md");
    const before = await readFile(readmePath, "utf8");
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures.some((failure) => failure.includes("gate headings must exactly match"))).toBe(
      true,
    );
    expect(await readFile(readmePath, "utf8")).toBe(before);
  });

  test("writes both projections only after full validation", async () => {
    const repoRoot = await createFixture(validRoadmap());
    expect(await checkProductPhaseFiles({ repoRoot, write: true })).toEqual([]);
    expect(await checkProductPhaseFiles({ repoRoot })).toEqual([]);
  });

  test("accepts the repository planning record and both projections", async () => {
    expect(await checkProductPhaseFiles()).toEqual([]);
  });
});
