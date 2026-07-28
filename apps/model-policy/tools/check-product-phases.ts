import { lstat, realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import Ajv2020, { type AnySchema, type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";

export type EvidenceLevel = "declared" | "implemented" | "verified" | "qualified" | "in_service";

export interface EvidenceReference {
  readonly record: string;
  readonly sha256: string;
}

export interface ProductPhaseGate {
  readonly id: string;
  readonly requiredEvidenceLevel: EvidenceLevel;
  readonly evidence: EvidenceReference[];
}

export interface ProductPhase {
  readonly id: string;
  readonly title: string;
  readonly outcome: string;
  readonly document: string;
  readonly dependsOn: string[];
  readonly activationPrerequisites: string[];
  readonly gates: ProductPhaseGate[];
}

export interface ProductPhaseRoadmap {
  readonly schemaVersion: "libre-ai.model-policy-phases.v1";
  readonly documentStatus: "draft" | "accepted_planning_record" | "superseded";
  readonly statusAuthorities: {
    readonly program: "GOALS.md";
    readonly execution: "STATUS.md";
  };
  readonly updatedAt: string;
  readonly phases: ProductPhase[];
}

interface DigestedPath {
  readonly path: string;
  readonly sha256: string;
}

interface EvidenceRecord {
  readonly schemaVersion: "libre-ai.model-policy-evidence-record.v1";
  readonly evidenceId: string;
  readonly phaseId: string;
  readonly gateId: string;
  readonly assertion: string;
  readonly achievedEvidenceLevel: EvidenceLevel;
  readonly sourceCommit: string;
  readonly artifactDigests: DigestedPath[];
  readonly supportingReviews: string[];
}

interface ProjectionUpdate {
  readonly path: string;
  readonly current: string;
  readonly expected: string;
}

export interface CheckProductPhaseFilesOptions {
  readonly repoRoot?: string;
  readonly write?: boolean;
}

const APP_START_MARKER = "<!-- model-policy-phases:start -->";
const APP_END_MARKER = "<!-- model-policy-phases:end -->";
const DOCS_START_MARKER = "<!-- model-policy-plan:start -->";
const DOCS_END_MARKER = "<!-- model-policy-plan:end -->";
const PHASE_DOCUMENT_PREFIX = "docs/apps/model-policy/phases/";
const EVIDENCE_RECORD_PREFIX = "distribution/evidence/model-policy/";
const REVIEW_PREFIX = "docs/reviews/";
const SHA256_PREFIX = "sha256:";
const EVIDENCE_LEVEL_RANK: Record<EvidenceLevel, number> = {
  declared: 0,
  implemented: 1,
  verified: 2,
  qualified: 3,
  in_service: 4,
};

export const DEFAULT_REPO_ROOT = resolve(import.meta.dir, "../../..");

function validationErrors(value: ErrorObject[] | null | undefined): string {
  return (value ?? [])
    .slice(0, 20)
    .map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`)
    .join("; ");
}

function isInside(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

function isAllowedPhaseDocument(path: string): boolean {
  return path.startsWith(PHASE_DOCUMENT_PREFIX) && path.endsWith(".md");
}

export function isAllowedEvidenceRecordPath(path: string): boolean {
  return path.startsWith(EVIDENCE_RECORD_PREFIX) && path.endsWith(".json");
}

function isAllowedReviewPath(path: string): boolean {
  return path.startsWith(REVIEW_PREFIX) && path.endsWith(".md");
}

async function loadTrackedPaths(repoRoot: string): Promise<Set<string>> {
  const process = Bun.spawn(["git", "ls-files", "-z"], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) throw new Error(`git ls-files failed: ${stderr.trim()}`);
  return new Set(stdout.split("\0").filter((path) => path.length > 0));
}

async function assertTrackedRegularFile(
  repoRoot: string,
  repositoryPath: string,
  trackedPaths: ReadonlySet<string>,
  context: string,
): Promise<string[]> {
  const failures: string[] = [];
  const absolutePath = resolve(repoRoot, repositoryPath);
  if (!isInside(repoRoot, absolutePath)) return [`${context}: path escapes repository`];
  if (!trackedPaths.has(repositoryPath)) {
    failures.push(`${context}: path is not tracked by git`);
  }
  try {
    const fileStats = await lstat(absolutePath);
    if (fileStats.isSymbolicLink() || !fileStats.isFile()) {
      failures.push(`${context}: path must be a regular non-symlink file`);
      return failures;
    }
    const canonicalPath = await realpath(absolutePath);
    if (!isInside(repoRoot, canonicalPath))
      failures.push(`${context}: canonical path escapes repository`);
  } catch {
    failures.push(`${context}: file does not exist`);
  }
  return failures;
}

function sha256Bytes(bytes: Uint8Array): string {
  const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  return `${SHA256_PREFIX}${digest}`;
}

async function sha256File(repoRoot: string, repositoryPath: string): Promise<string> {
  const bytes = new Uint8Array(await Bun.file(resolve(repoRoot, repositoryPath)).arrayBuffer());
  return sha256Bytes(bytes);
}

async function commitExists(repoRoot: string, commit: string): Promise<boolean> {
  const process = Bun.spawn(["git", "cat-file", "-e", `${commit}^{commit}`], {
    cwd: repoRoot,
    stdout: "ignore",
    stderr: "ignore",
  });
  return (await process.exited) === 0;
}

async function blobAtCommit(
  repoRoot: string,
  commit: string,
  repositoryPath: string,
): Promise<Uint8Array | null> {
  const treeProcess = Bun.spawn(["git", "ls-tree", commit, "--", repositoryPath], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "ignore",
  });
  const [treeOutput, treeExitCode] = await Promise.all([
    new Response(treeProcess.stdout).text(),
    treeProcess.exited,
  ]);
  if (treeExitCode !== 0 || !/^100(?:644|755) blob [0-9a-f]{40}\t/.test(treeOutput)) {
    return null;
  }
  const showProcess = Bun.spawn(["git", "show", `${commit}:${repositoryPath}`], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "ignore",
  });
  const [bytes, showExitCode] = await Promise.all([
    new Response(showProcess.stdout).bytes(),
    showProcess.exited,
  ]);
  return showExitCode === 0 ? bytes : null;
}

export function validateRoadmapSemantics(roadmap: ProductPhaseRoadmap): string[] {
  const failures: string[] = [];
  const phasesById = new Map<string, ProductPhase>();
  const gateIds = new Set<string>();

  for (const phase of roadmap.phases) {
    if (phasesById.has(phase.id)) failures.push(`${phase.id}: duplicate phase id`);
    phasesById.set(phase.id, phase);

    for (const gate of phase.gates) {
      if (!gate.id.startsWith(`${phase.id}-G`)) {
        failures.push(`${gate.id}: gate id does not belong to ${phase.id}`);
      }
      if (gateIds.has(gate.id)) failures.push(`${gate.id}: duplicate gate id`);
      gateIds.add(gate.id);
      const evidencePaths = gate.evidence.map((reference) => reference.record);
      if (new Set(evidencePaths).size !== evidencePaths.length) {
        failures.push(`${gate.id}: duplicate evidence record`);
      }
    }
  }

  for (const phase of roadmap.phases) {
    for (const dependencyId of phase.dependsOn) {
      if (!phasesById.has(dependencyId)) {
        failures.push(`${phase.id}: unknown dependency ${dependencyId}`);
      }
      if (dependencyId === phase.id) failures.push(`${phase.id}: self dependency`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(phaseId: string): void {
    if (visiting.has(phaseId)) {
      failures.push(`${phaseId}: dependency cycle`);
      return;
    }
    if (visited.has(phaseId)) return;
    visiting.add(phaseId);
    for (const dependencyId of phasesById.get(phaseId)?.dependsOn ?? []) {
      if (phasesById.has(dependencyId)) visit(dependencyId);
    }
    visiting.delete(phaseId);
    visited.add(phaseId);
  }
  for (const phaseId of phasesById.keys()) visit(phaseId);

  return [...new Set(failures)];
}

export function extractGateIds(document: string): string[] {
  return [...document.matchAll(/^### (MP-P[0-9]+-G[0-9]{2}) — .+$/gm)].map(
    (match) => match[1] ?? "",
  );
}

function compareGateDefinitions(phase: ProductPhase, content: string): string[] {
  const failures: string[] = [];
  const documentedGateIds = extractGateIds(content);
  const registeredGateIds = phase.gates.map((gate) => gate.id);
  if (new Set(documentedGateIds).size !== documentedGateIds.length) {
    failures.push(`${phase.document}: duplicate gate heading`);
  }
  if (JSON.stringify(documentedGateIds) !== JSON.stringify(registeredGateIds)) {
    failures.push(
      `${phase.document}: gate headings must exactly match registry order ` +
        `(${registeredGateIds.join(", ")})`,
    );
  }
  return failures;
}

function evidenceCoverage(phase: ProductPhase): string {
  const evidencedGates = phase.gates.filter((gate) => gate.evidence.length > 0).length;
  return `${evidencedGates}/${phase.gates.length}`;
}

export function renderReadmeProjection(roadmap: ProductPhaseRoadmap): string {
  const lines = [
    "Planning record: [`phases.v1.json`](../../docs/apps/model-policy/phases.v1.json) " +
      `(\`${roadmap.documentStatus}\`). Global execution status remains exclusively owned by ` +
      "[`GOALS.md`](../../GOALS.md) and [`STATUS.md`](../../STATUS.md).",
    "",
    "| Phase | Planned outcome | Gate evidence | Detail |",
    "| --- | --- | ---: | --- |",
  ];
  for (const phase of roadmap.phases) {
    lines.push(
      `| ${phase.id} · ${phase.title} | ${phase.outcome} | ${evidenceCoverage(phase)} | ` +
        `[Phase record](../../${phase.document}) |`,
    );
  }
  lines.push(
    "",
    "Evidence coverage is not execution status. No phase is activated by this draft: owner selection, " +
      "wave 4b activation, and accepted bounded work packages must first be recorded by the global authorities.",
  );
  return lines.join("\n");
}

export function renderDocsProjection(roadmap: ProductPhaseRoadmap): string {
  const lines = [
    "| Phase | Planned product outcome | Depends on | Evidence records |",
    "| --- | --- | --- | ---: |",
  ];
  for (const phase of roadmap.phases) {
    const relativeDocument = phase.document.replace("docs/apps/model-policy/", "");
    lines.push(
      `| [${phase.id}](${relativeDocument}) | ${phase.outcome} | ` +
        `${phase.dependsOn.length === 0 ? "—" : phase.dependsOn.join(", ")} | ${evidenceCoverage(phase)} |`,
    );
  }
  return lines.join("\n");
}

export function replaceProjection(
  source: string,
  projection: string,
  startMarker = APP_START_MARKER,
  endMarker = APP_END_MARKER,
): string {
  const startCount = source.split(startMarker).length - 1;
  const endCount = source.split(endMarker).length - 1;
  if (startCount !== 1 || endCount !== 1) {
    throw new Error("README phase projection markers must occur exactly once");
  }
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker);
  if (startIndex > endIndex) throw new Error("README phase projection markers are reversed");
  const before = source.slice(0, startIndex + startMarker.length);
  const after = source.slice(endIndex);
  return `${before}\n${projection}\n${after}`;
}

export function replaceReadmeProjection(source: string, projection: string): string {
  return replaceProjection(source, projection);
}

async function validateEvidenceReference(
  repoRoot: string,
  phase: ProductPhase,
  gate: ProductPhaseGate,
  reference: EvidenceReference,
  trackedPaths: ReadonlySet<string>,
  validateEvidenceRecord: ValidateFunction,
): Promise<string[]> {
  const failures: string[] = [];
  if (!isAllowedEvidenceRecordPath(reference.record)) {
    return [`${gate.id}: evidence record path is outside ${EVIDENCE_RECORD_PREFIX}`];
  }
  failures.push(
    ...(await assertTrackedRegularFile(
      repoRoot,
      reference.record,
      trackedPaths,
      `${gate.id}: evidence`,
    )),
  );
  if (failures.length > 0) return failures;

  const actualDigest = await sha256File(repoRoot, reference.record);
  if (actualDigest !== reference.sha256) {
    failures.push(`${gate.id}: evidence record digest mismatch for ${reference.record}`);
    return failures;
  }

  let unknownRecord: unknown;
  try {
    unknownRecord = await Bun.file(resolve(repoRoot, reference.record)).json();
  } catch {
    failures.push(`${gate.id}: evidence record is not valid JSON`);
    return failures;
  }
  if (!validateEvidenceRecord(unknownRecord)) {
    failures.push(
      `${gate.id}: evidence schema rejected ${reference.record}: ` +
        validationErrors(validateEvidenceRecord.errors),
    );
    return failures;
  }
  const record = unknownRecord as EvidenceRecord;
  if (record.phaseId !== phase.id || record.gateId !== gate.id) {
    failures.push(`${gate.id}: evidence record phase/gate binding does not match`);
  }
  if (
    EVIDENCE_LEVEL_RANK[record.achievedEvidenceLevel] <
    EVIDENCE_LEVEL_RANK[gate.requiredEvidenceLevel]
  ) {
    failures.push(
      `${gate.id}: ${record.achievedEvidenceLevel} evidence is below ` +
        `${gate.requiredEvidenceLevel}`,
    );
  }
  if (!(await commitExists(repoRoot, record.sourceCommit))) {
    failures.push(`${gate.id}: source commit ${record.sourceCommit} is unavailable`);
  }

  for (const artifact of record.artifactDigests) {
    const bytes = await blobAtCommit(repoRoot, record.sourceCommit, artifact.path);
    if (bytes === null) {
      failures.push(
        `${gate.id}: artifact ${artifact.path} is not a regular file at ${record.sourceCommit}`,
      );
      continue;
    }
    if (sha256Bytes(bytes) !== artifact.sha256) {
      failures.push(`${gate.id}: artifact digest mismatch for ${artifact.path}`);
    }
  }
  const artifactPaths = new Set(record.artifactDigests.map((artifact) => artifact.path));
  for (const reviewPath of record.supportingReviews) {
    if (!isAllowedReviewPath(reviewPath)) {
      failures.push(`${gate.id}: supporting review path is outside ${REVIEW_PREFIX}`);
      continue;
    }
    if (!artifactPaths.has(reviewPath)) {
      failures.push(`${gate.id}: supporting review ${reviewPath} lacks an artifact digest`);
    }
  }
  return failures;
}

async function readUnknownJson(path: string): Promise<unknown> {
  return Bun.file(path).json() as Promise<unknown>;
}

function checkedSchema(value: unknown, name: string): AnySchema {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be a JSON object`);
  }
  return value as AnySchema;
}

export async function checkProductPhaseFiles(
  options: CheckProductPhaseFilesOptions = {},
): Promise<string[]> {
  const repoRoot = await realpath(resolve(options.repoRoot ?? DEFAULT_REPO_ROOT));
  const failures: string[] = [];
  const projectionUpdates: ProjectionUpdate[] = [];
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);

  let roadmapSchema: unknown;
  let evidenceSchema: unknown;
  let unknownRoadmap: unknown;
  try {
    [roadmapSchema, evidenceSchema, unknownRoadmap] = await Promise.all([
      readUnknownJson(resolve(repoRoot, "docs/apps/model-policy/phases.v1.schema.json")),
      readUnknownJson(resolve(repoRoot, "docs/apps/model-policy/evidence-record.v1.schema.json")),
      readUnknownJson(resolve(repoRoot, "docs/apps/model-policy/phases.v1.json")),
    ]);
  } catch (error) {
    return [
      error instanceof Error
        ? `Model Policy plan JSON read failed: ${error.message}`
        : "Model Policy plan JSON read failed",
    ];
  }

  let validateRoadmap: ValidateFunction;
  let validateEvidenceRecord: ValidateFunction;
  try {
    validateRoadmap = ajv.compile(checkedSchema(roadmapSchema, "Roadmap schema"));
    validateEvidenceRecord = ajv.compile(checkedSchema(evidenceSchema, "Evidence schema"));
  } catch (error) {
    return [
      error instanceof Error
        ? `Model Policy schema compilation failed: ${error.message}`
        : "Model Policy schema compilation failed",
    ];
  }
  if (!validateRoadmap(unknownRoadmap)) {
    return [`Model Policy phase schema rejected: ${validationErrors(validateRoadmap.errors)}`];
  }
  const roadmap = unknownRoadmap as ProductPhaseRoadmap;
  failures.push(...validateRoadmapSemantics(roadmap));

  let trackedPaths: Set<string>;
  try {
    trackedPaths = await loadTrackedPaths(repoRoot);
  } catch (error) {
    return [error instanceof Error ? error.message : "Unable to load tracked paths"];
  }

  for (const phase of roadmap.phases) {
    if (!isAllowedPhaseDocument(phase.document)) {
      failures.push(`${phase.id}: phase document path is outside ${PHASE_DOCUMENT_PREFIX}`);
      continue;
    }
    failures.push(
      ...(await assertTrackedRegularFile(repoRoot, phase.document, trackedPaths, phase.id)),
    );
    if (failures.some((failure) => failure.startsWith(`${phase.id}:`))) continue;
    const content = await Bun.file(resolve(repoRoot, phase.document)).text();
    if (!content.startsWith(`# ${phase.id} —`)) {
      failures.push(`${phase.document}: title must start with ${phase.id}`);
    }
    failures.push(...compareGateDefinitions(phase, content));
    for (const gate of phase.gates) {
      for (const reference of gate.evidence) {
        failures.push(
          ...(await validateEvidenceReference(
            repoRoot,
            phase,
            gate,
            reference,
            trackedPaths,
            validateEvidenceRecord,
          )),
        );
      }
    }
  }

  const projections = [
    {
      path: "apps/model-policy/README.md",
      projection: renderReadmeProjection(roadmap),
      startMarker: APP_START_MARKER,
      endMarker: APP_END_MARKER,
    },
    {
      path: "docs/apps/model-policy/README.md",
      projection: renderDocsProjection(roadmap),
      startMarker: DOCS_START_MARKER,
      endMarker: DOCS_END_MARKER,
    },
  ];
  for (const projection of projections) {
    const current = await Bun.file(resolve(repoRoot, projection.path)).text();
    try {
      const expected = replaceProjection(
        current,
        projection.projection,
        projection.startMarker,
        projection.endMarker,
      );
      projectionUpdates.push({ path: projection.path, current, expected });
      if (!options.write && expected !== current) {
        failures.push(`${projection.path}: generated phase projection is stale`);
      }
    } catch (error) {
      failures.push(
        error instanceof Error
          ? `${projection.path}: ${error.message}`
          : `${projection.path}: projection failed`,
      );
    }
  }

  if (failures.length > 0) return [...new Set(failures)];
  if (options.write) {
    for (const update of projectionUpdates) {
      if (update.current !== update.expected) {
        await Bun.write(resolve(repoRoot, update.path), update.expected);
      }
    }
  }
  return [];
}

async function run(): Promise<void> {
  const write = Bun.argv.includes("--write");
  const failures = await checkProductPhaseFiles({ write });
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exitCode = 1;
    return;
  }
  const roadmap = (await Bun.file(
    resolve(DEFAULT_REPO_ROOT, "docs/apps/model-policy/phases.v1.json"),
  ).json()) as ProductPhaseRoadmap;
  console.log(
    `Model Policy phase plan verified: ${roadmap.phases.length} phases, ` +
      `${roadmap.phases.flatMap((phase) => phase.gates).length} gates`,
  );
}

if (import.meta.main) await run();
