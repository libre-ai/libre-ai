import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkProductPhaseFiles,
  DEFAULT_REPO_ROOT,
  extractGateIds,
  isAllowedEvidenceRecordPath,
  type ProductPhaseRoadmap,
  type ReviewRole,
  replaceReadmeProjection,
  validateRoadmapSemantics,
} from "./check-product-phases";

const temporaryDirectories: string[] = [];
const FIXTURE_EVIDENCE_PATH = "distribution/evidence/model-policy/mp-p0-g01-fixture.json";

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
        requiredIndependentReviewRoles: ["architecture", "security", "technical"],
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
        requiredIndependentReviewRoles: ["business", "privacy"],
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

async function runGitOutput(repoRoot: string, args: string[]): Promise<string> {
  const process = Bun.spawn(["git", ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
  return stdout.trim();
}

function sha256(value: string | Uint8Array): string {
  return `sha256:${new Bun.CryptoHasher("sha256").update(value).digest("hex")}`;
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
    "distribution/evidence/model-policy/operations",
    "distribution/evidence/model-policy/reviews",
    "docs/apps/model-policy/phases",
    "docs/apps/model-policy",
    "docs/reviews/model-policy",
  ];
  for (const directory of directories) await mkdir(join(repoRoot, directory), { recursive: true });

  const sourceFiles = [
    "docs/apps/model-policy/phases.v1.schema.json",
    "docs/apps/model-policy/evidence-record.v1.schema.json",
    "docs/apps/model-policy/review-attestation.v1.schema.json",
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
  const reviewRoles: ReviewRole[] = [
    "accessibility",
    "architecture",
    "business",
    "legal",
    "operations",
    "performance",
    "privacy",
    "security",
    "technical",
  ];
  for (const role of reviewRoles) {
    await writeFile(
      join(repoRoot, `docs/reviews/model-policy/${role}.md`),
      `# Independent ${role} review\n\nVerdict: approve.\n`,
    );
  }
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

interface EvidenceFixtureOptions {
  readonly achievedEvidenceLevel?: "verified" | "qualified" | "in_service";
  readonly commands?: string[];
  readonly harnessIdentifiers?: string[];
  readonly emptyToolVersions?: boolean;
  readonly emptyInputIdentities?: boolean;
  readonly roles?: ReviewRole[];
  readonly producerRef?: string;
  readonly sharedReviewerRef?: string;
  readonly sharedReviewId?: boolean;
  readonly verdict?: "approve" | "approve_with_minor_reservations" | "reject" | "not_applicable";
  readonly majorFindings?: string[];
  readonly attestationVerdict?: "approve" | "approve_with_minor_reservations" | "reject";
  readonly attestationMajorFindings?: string[];
  readonly inputDigest?: string;
  readonly includeServiceObservation?: boolean;
  readonly phaseId?: string;
  readonly gateId?: string;
  readonly sourceCommit?: string;
  readonly referenceDigest?: string;
  readonly artifactPath?: string;
  readonly invalidServiceDigest?: boolean;
  readonly incidentState?: "none_observed" | "incidents_bound_in_artifacts";
}

async function addEvidenceFixture(
  repoRoot: string,
  options: EvidenceFixtureOptions = {},
): Promise<void> {
  await runGit(repoRoot, ["config", "user.email", "fixture@example.invalid"]);
  await runGit(repoRoot, ["config", "user.name", "Fixture"]);
  await runGit(repoRoot, ["commit", "-q", "-m", "fixture source"]);
  const sourceCommit = await runGitOutput(repoRoot, ["rev-parse", "HEAD"]);
  const roadmapPath = join(repoRoot, "docs/apps/model-policy/phases.v1.json");
  const roadmap = JSON.parse(await readFile(roadmapPath, "utf8")) as ProductPhaseRoadmap;
  const phase = roadmap.phases[0];
  const gate = phase?.gates[0];
  if (!phase || !gate) throw new Error("fixture roadmap lacks MP-P0-G01");

  const phaseDocumentBytes = new Uint8Array(
    await Bun.file(join(repoRoot, phase.document)).arrayBuffer(),
  );
  const phaseDocumentDigest = sha256(phaseDocumentBytes);
  const artifactPath = options.artifactPath ?? phase.document;
  const artifactDigest = sha256(
    new Uint8Array(await Bun.file(join(repoRoot, artifactPath)).arrayBuffer()),
  );
  const roles = options.roles ?? phase.requiredIndependentReviewRoles;
  const reviewBindings = await Promise.all(
    roles.map(async (role) => {
      const reportPath = `docs/reviews/model-policy/${role}.md`;
      const reviewerRef = options.sharedReviewerRef ?? `reviewer:${role}`;
      const reportSha256 = sha256(
        new Uint8Array(await Bun.file(join(repoRoot, reportPath)).arrayBuffer()),
      );
      const attestationRecord = `distribution/evidence/model-policy/reviews/mp-p0-g01-${role}.json`;
      const attestation = {
        schemaVersion: "libre-ai.model-policy-review-attestation.v1",
        reviewId: options.sharedReviewId
          ? "MP-REV-P0-G01-SHARED"
          : `MP-REV-P0-G01-${role.toUpperCase()}`,
        phaseId: phase.id,
        gateId: gate.id,
        candidateCommit: sourceCommit,
        role,
        reviewerRef,
        verdict: options.attestationVerdict ?? "approve",
        findings: {
          blocking: [],
          major: options.attestationMajorFindings ?? [],
          minor: [],
          residual: ["Fixture review attestation is not product evidence."],
        },
        reportPath,
        reportSha256,
        recordedAt: "2026-07-28T00:00:00Z",
      };
      const attestationText = `${JSON.stringify(attestation, null, 2)}\n`;
      await writeFile(join(repoRoot, attestationRecord), attestationText);
      return {
        role,
        reviewerRef,
        attestationRecord,
        sha256: sha256(attestationText),
      };
    }),
  );
  const evidenceRecord: Record<string, unknown> = {
    schemaVersion: "libre-ai.model-policy-evidence-record.v1",
    evidenceId: "MP-EVD-P0-G01-FIXTURE",
    phaseId: options.phaseId ?? phase.id,
    gateId: options.gateId ?? gate.id,
    assertion: "The fixture gate has independently reproducible evidence.",
    achievedEvidenceLevel: options.achievedEvidenceLevel ?? "qualified",
    sourceCommit: options.sourceCommit ?? sourceCommit,
    evidenceProducerRef: options.producerRef ?? "producer:fixture",
    artifactDigests: [{ path: artifactPath, sha256: artifactDigest }],
    toolVersions: options.emptyToolVersions ? [] : [{ tool: "bun", version: Bun.version }],
    inputIdentities: options.emptyInputIdentities
      ? []
      : [
          {
            kind: "repository_fixture",
            identifier: "model-policy:phase-document:v1",
            path: phase.document,
            sha256: options.inputDigest ?? phaseDocumentDigest,
          },
        ],
    commands: options.commands ?? ["bun test apps/model-policy/tools/check-product-phases.test.ts"],
    expectedResults: ["The gate evidence validation passes."],
    observedResults: ["The gate evidence validation passed."],
    findings: {
      blocking: [],
      major: options.majorFindings ?? [],
      minor: [],
      residual: ["Fixture-only evidence does not activate a product phase."],
    },
    verdict: options.verdict ?? "approve",
    reviewBindings,
    harnessIdentifiers: options.harnessIdentifiers ?? ["bun:test:model-policy-phase-checker"],
    invalidationConditions: ["Any bound artifact digest changes."],
    recordedAt: "2026-07-28T00:00:00Z",
  };
  if (options.includeServiceObservation) {
    const smokeEvidencePath = "distribution/evidence/model-policy/operations/mp-p0-g01-smoke.json";
    const rollbackEvidencePath =
      "distribution/evidence/model-policy/operations/mp-p0-g01-rollback.json";
    const smokeEvidence = '{"status":"passed","deployment":"fixture"}\n';
    const rollbackEvidence = '{"status":"passed","restored":"fixture"}\n';
    await writeFile(join(repoRoot, smokeEvidencePath), smokeEvidence);
    await writeFile(join(repoRoot, rollbackEvidencePath), rollbackEvidence);
    evidenceRecord.serviceObservation = {
      deploymentIdentity: "deployment:model-policy:fixture",
      windowStartedAt: "2026-07-27T00:00:00Z",
      windowEndedAt: "2026-07-28T00:00:00Z",
      smokeEvidencePath,
      smokeEvidenceSha256: options.invalidServiceDigest
        ? `sha256:${"0".repeat(64)}`
        : sha256(smokeEvidence),
      rollbackEvidencePath,
      rollbackEvidenceSha256: sha256(rollbackEvidence),
      incidentState: options.incidentState ?? "none_observed",
      incidentEvidence: [],
    };
  }
  const evidenceText = `${JSON.stringify(evidenceRecord, null, 2)}\n`;
  await writeFile(join(repoRoot, FIXTURE_EVIDENCE_PATH), evidenceText);
  gate.evidence.push({
    record: FIXTURE_EVIDENCE_PATH,
    sha256: options.referenceDigest ?? sha256(evidenceText),
  });
  await writeFile(roadmapPath, `${JSON.stringify(roadmap, null, 2)}\n`);
  await runGit(repoRoot, ["add", "."]);
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

  test("accepts qualified evidence with versioned tools, inputs, harnesses and required reviews", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot);
    expect(await checkProductPhaseFiles({ repoRoot, write: true })).toEqual([]);
    expect(await checkProductPhaseFiles({ repoRoot })).toEqual([]);
  });

  test("rejects an untracked evidence record", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot);
    await runGit(repoRoot, ["rm", "-q", "--cached", "--", FIXTURE_EVIDENCE_PATH]);
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures).toContain("MP-P0-G01: evidence: path is not tracked by git");
  });

  test("rejects a symlink evidence record from the git index", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot);
    const evidencePath = join(repoRoot, FIXTURE_EVIDENCE_PATH);
    await rm(evidencePath);
    await symlink("../../../docs/apps/model-policy/phases.v1.json", evidencePath);
    await runGit(repoRoot, ["add", "--", FIXTURE_EVIDENCE_PATH]);
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures).toContain(
      "MP-P0-G01: evidence: git index entry must be a regular non-symlink file",
    );
  });

  test("rejects a mismatched evidence-record digest", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, { referenceDigest: `sha256:${"0".repeat(64)}` });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures).toContain(
      `MP-P0-G01: evidence record digest mismatch for ${FIXTURE_EVIDENCE_PATH}`,
    );
  });

  test("rejects phase and gate identity drift inside a content-addressed record", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, { phaseId: "MP-P1", gateId: "MP-P1-G01" });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures).toContain("MP-P0-G01: evidence record phase/gate binding does not match");
  });

  test("rejects evidence that does not digest the gate-definition document", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, {
      artifactPath: "docs/apps/model-policy/phases.v1.json",
    });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures).toContain("MP-P0-G01: evidence does not bind the gate-definition document");
  });

  test("rejects evidence below the gate-required level", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, { achievedEvidenceLevel: "verified", roles: [] });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures).toContain("MP-P0-G01: verified evidence is below qualified");
  });

  test("rejects an unavailable source commit", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, { sourceCommit: "f".repeat(40) });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures).toContain(`MP-P0-G01: source commit ${"f".repeat(40)} is unavailable`);
  });

  test("rejects qualified evidence without reproducible commands or harnesses", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, {
      commands: [],
      harnessIdentifiers: [],
      emptyToolVersions: true,
      emptyInputIdentities: true,
    });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures.some((failure) => failure.includes("evidence schema rejected"))).toBe(true);
  });

  test("rejects not-applicable verdicts for qualified evidence", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, { verdict: "not_applicable" });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures.some((failure) => failure.includes("evidence schema rejected"))).toBe(true);
  });

  test("rejects qualified evidence missing a phase-required independent review", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, { roles: ["architecture", "security"] });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures).toContain("MP-P0-G01: missing required independent technical review");
  });

  test("rejects self-review and a shared reviewer across required roles", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, {
      producerRef: "reviewer:self",
      sharedReviewerRef: "reviewer:self",
    });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(
      failures.some((failure) => failure.includes("reviewer must differ from evidence producer")),
    ).toBe(true);
    expect(
      failures.some((failure) => failure.includes("reviewer ref must be role-separated")),
    ).toBe(true);
  });

  test("rejects one review identity reused by multiple attestation records", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, { sharedReviewId: true });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(
      failures.some((failure) =>
        failure.includes("review id MP-REV-P0-G01-SHARED is already bound"),
      ),
    ).toBe(true);
  });

  test("rejects a qualified record with a rejecting verdict or unresolved major finding", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, {
      verdict: "reject",
      majorFindings: ["The evidence remains incomplete."],
    });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures).toContain("MP-P0-G01: qualified evidence verdict does not approve the gate");
    expect(failures).toContain("MP-P0-G01: qualified evidence retains blocking or major findings");
  });

  test("rejects a favorable evidence record backed by a rejecting independent attestation", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, {
      attestationVerdict: "reject",
      attestationMajorFindings: ["The independent review rejected the candidate."],
    });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(
      failures.some((failure) => failure.includes("review attestation: verdict does not approve")),
    ).toBe(true);
    expect(
      failures.some((failure) => failure.includes("review attestation: retains blocking or major")),
    ).toBe(true);
  });

  test("rejects a repository fixture digest not bound to the source commit", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, { inputDigest: `sha256:${"0".repeat(64)}` });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures).toContain(
      "MP-P0-G01: repository fixture digest mismatch for docs/apps/model-policy/phases/00-foundation.md",
    );
  });

  test("requires service identity and operational evidence for in-service claims", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, { achievedEvidenceLevel: "in_service" });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures.some((failure) => failure.includes("evidence schema rejected"))).toBe(true);
  });

  test("rejects in-service evidence with an unbound operational artifact", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, {
      achievedEvidenceLevel: "in_service",
      includeServiceObservation: true,
      invalidServiceDigest: true,
    });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(
      failures.some((failure) => failure.includes("service observation digest mismatch")),
    ).toBe(true);
  });

  test("requires incident artifacts when an in-service window reports incidents", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, {
      achievedEvidenceLevel: "in_service",
      includeServiceObservation: true,
      incidentState: "incidents_bound_in_artifacts",
    });
    const failures = await checkProductPhaseFiles({ repoRoot, write: true });
    expect(failures.some((failure) => failure.includes("evidence schema rejected"))).toBe(true);
  });

  test("accepts in-service evidence only with a bounded observation window and bound smoke/rollback artifacts", async () => {
    const repoRoot = await createFixture(validRoadmap());
    await addEvidenceFixture(repoRoot, {
      achievedEvidenceLevel: "in_service",
      includeServiceObservation: true,
    });
    expect(await checkProductPhaseFiles({ repoRoot, write: true })).toEqual([]);
  });

  test("leaves both projections unchanged when staging the second write fails", async () => {
    const repoRoot = await createFixture(validRoadmap());
    const appReadmePath = join(repoRoot, "apps/model-policy/README.md");
    const docsReadmePath = join(repoRoot, "docs/apps/model-policy/README.md");
    const docsDirectory = join(repoRoot, "docs/apps/model-policy");
    const beforeApp = await readFile(appReadmePath, "utf8");
    const beforeDocs = await readFile(docsReadmePath, "utf8");
    await chmod(docsDirectory, 0o500);
    try {
      const failures = await checkProductPhaseFiles({ repoRoot, write: true });
      expect(failures[0]).toStartWith("Model Policy projection write failed:");
      expect(await readFile(appReadmePath, "utf8")).toBe(beforeApp);
      expect(await readFile(docsReadmePath, "utf8")).toBe(beforeDocs);
    } finally {
      await chmod(docsDirectory, 0o700);
    }
  });

  test("rolls back the first projection when replacing the second projection fails", async () => {
    const repoRoot = await createFixture(validRoadmap());
    const appReadmePath = join(repoRoot, "apps/model-policy/README.md");
    const docsReadmePath = join(repoRoot, "docs/apps/model-policy/README.md");
    const beforeApp = await readFile(appReadmePath, "utf8");
    const beforeDocs = await readFile(docsReadmePath, "utf8");
    let renameCalls = 0;
    const failures = await checkProductPhaseFiles({
      repoRoot,
      write: true,
      projectionRename: async (oldPath, newPath) => {
        renameCalls += 1;
        if (renameCalls === 2) throw new Error("injected second replacement failure");
        await rename(oldPath, newPath);
      },
    });
    expect(failures).toContain(
      "Model Policy projection write failed: injected second replacement failure",
    );
    expect(await readFile(appReadmePath, "utf8")).toBe(beforeApp);
    expect(await readFile(docsReadmePath, "utf8")).toBe(beforeDocs);
  });

  test("accepts the repository planning record and both projections", async () => {
    expect(await checkProductPhaseFiles()).toEqual([]);
  });
});
