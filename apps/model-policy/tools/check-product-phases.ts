import { chmod, lstat, realpath, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import Ajv2020, { type AnySchema, type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";

import { containsSensitivePublicMarker } from "../../../tools/quality/public-source-scanner";

export type EvidenceLevel = "declared" | "implemented" | "verified" | "qualified" | "in_service";
export type ReviewRole =
  | "accessibility"
  | "architecture"
  | "business"
  | "legal"
  | "operations"
  | "performance"
  | "privacy"
  | "security"
  | "technical";

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
  readonly requiredIndependentReviewRoles: ReviewRole[];
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

interface InputIdentity {
  readonly kind:
    | "repository_fixture"
    | "synthetic_corpus"
    | "restricted_corpus"
    | "operated_environment";
  readonly identifier: string;
  readonly path?: string;
  readonly sha256: string;
}

interface ReviewBinding {
  readonly role: ReviewRole;
  readonly reviewerRef: string;
  readonly attestationRecord: string;
  readonly sha256: string;
}

interface ReviewAttestation {
  readonly schemaVersion: "libre-ai.model-policy-review-attestation.v1";
  readonly reviewId: string;
  readonly phaseId: string;
  readonly gateId: string;
  readonly candidateCommit: string;
  readonly role: ReviewRole;
  readonly reviewerRef: string;
  readonly verdict: "approve" | "approve_with_minor_reservations" | "reject";
  readonly findings: {
    readonly blocking: string[];
    readonly major: string[];
    readonly minor: string[];
    readonly residual: string[];
  };
  readonly reportPath: string;
  readonly reportSha256: string;
}

type OperationalEvidenceKind =
  | "deployment_authorization"
  | "smoke_test"
  | "rollback_test"
  | "incident_report";

type OperationalEvidenceOutcome = "authorized" | "passed" | "resolved";

interface OperationalEvidence {
  readonly schemaVersion: "libre-ai.model-policy-operational-evidence.v1";
  readonly operationalEvidenceId: string;
  readonly kind: OperationalEvidenceKind;
  readonly phaseId: string;
  readonly gateId: string;
  readonly evidenceId: string;
  readonly deploymentIdentity: string;
  readonly windowStartedAt: string;
  readonly windowEndedAt: string;
  readonly outcome: OperationalEvidenceOutcome;
  readonly authorizationRef?: string;
  readonly observedAt?: string;
  readonly incidentId?: string;
  readonly recordedAt: string;
}

interface ServiceObservation {
  readonly deploymentIdentity: string;
  readonly windowStartedAt: string;
  readonly windowEndedAt: string;
  readonly authorizationEvidencePath: string;
  readonly authorizationEvidenceSha256: string;
  readonly smokeEvidencePath: string;
  readonly smokeEvidenceSha256: string;
  readonly rollbackEvidencePath: string;
  readonly rollbackEvidenceSha256: string;
  readonly incidentState: "none_observed" | "incidents_bound_in_artifacts";
  readonly incidentEvidence: DigestedPath[];
}

interface EvidenceRecord {
  readonly schemaVersion: "libre-ai.model-policy-evidence-record.v1";
  readonly evidenceId: string;
  readonly phaseId: string;
  readonly gateId: string;
  readonly gateDefinitionSha256: string;
  readonly assertion: string;
  readonly achievedEvidenceLevel: EvidenceLevel;
  readonly sourceCommit: string;
  readonly evidenceProducerRef: string;
  readonly artifactDigests: DigestedPath[];
  readonly inputIdentities: InputIdentity[];
  readonly verdict: "approve" | "approve_with_minor_reservations" | "reject" | "not_applicable";
  readonly findings: {
    readonly blocking: string[];
    readonly major: string[];
    readonly minor: string[];
    readonly residual: string[];
  };
  readonly reviewBindings: ReviewBinding[];
  readonly serviceObservation?: ServiceObservation;
  readonly recordedAt: string;
}

interface ProjectionUpdate {
  readonly path: string;
  readonly current: string;
  readonly expected: string;
}

type RenameFile = (oldPath: string, newPath: string) => Promise<void>;

export interface ProductPhaseSummary {
  readonly phaseCount: number;
  readonly gateCount: number;
}

export interface CheckProductPhaseFilesOptions {
  readonly repoRoot?: string;
  readonly write?: boolean;
  readonly projectionRename?: RenameFile;
  readonly onValidatedSummary?: (summary: ProductPhaseSummary) => void;
}

const APP_START_MARKER = "<!-- model-policy-phases:start -->";
const APP_END_MARKER = "<!-- model-policy-phases:end -->";
const DOCS_START_MARKER = "<!-- model-policy-plan:start -->";
const DOCS_END_MARKER = "<!-- model-policy-plan:end -->";
const PHASE_DOCUMENT_PREFIX = "docs/apps/model-policy/phases/";
const EVIDENCE_RECORD_PREFIX = "distribution/evidence/model-policy/";
const REVIEW_ATTESTATION_PREFIX = "distribution/evidence/model-policy/reviews/";
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

function isAllowedPhaseDocument(path: string): boolean {
  return path.startsWith(PHASE_DOCUMENT_PREFIX) && path.endsWith(".md");
}

export function isAllowedEvidenceRecordPath(path: string): boolean {
  return path.startsWith(EVIDENCE_RECORD_PREFIX) && path.endsWith(".json");
}

function isAllowedReviewAttestationPath(path: string): boolean {
  return path.startsWith(REVIEW_ATTESTATION_PREFIX) && path.endsWith(".json");
}

function isAllowedReviewPath(path: string): boolean {
  return path.startsWith(REVIEW_PREFIX) && path.endsWith(".md");
}

interface TrackedIndexEntry {
  readonly mode: string;
  readonly objectId: string;
}

async function loadTrackedIndex(repoRoot: string): Promise<Map<string, TrackedIndexEntry>> {
  const process = Bun.spawn(["git", "ls-files", "--stage", "-z"], {
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

  const entries = new Map<string, TrackedIndexEntry>();
  for (const rawEntry of stdout.split("\0")) {
    if (rawEntry.length === 0) continue;
    const separatorIndex = rawEntry.indexOf("\t");
    if (separatorIndex < 0) throw new Error("git ls-files returned an invalid index entry");
    const [mode, objectId, stage] = rawEntry.slice(0, separatorIndex).split(" ");
    const path = rawEntry.slice(separatorIndex + 1);
    if (!mode || !objectId || stage !== "0" || !/^[0-9a-f]{40,64}$/.test(objectId)) {
      throw new Error(`git index entry is unmerged or invalid: ${path}`);
    }
    entries.set(path, { mode, objectId });
  }
  return entries;
}

async function readTrackedRegularBlob(
  repoRoot: string,
  repositoryPath: string,
  trackedIndex: ReadonlyMap<string, TrackedIndexEntry>,
  context: string,
): Promise<{ readonly failures: string[]; readonly bytes: Uint8Array | null }> {
  const entry = trackedIndex.get(repositoryPath);
  if (!entry) return { failures: [`${context}: path is not tracked by git`], bytes: null };
  if (entry.mode !== "100644" && entry.mode !== "100755") {
    return {
      failures: [`${context}: git index entry must be a regular non-symlink file`],
      bytes: null,
    };
  }
  const process = Bun.spawn(["git", "cat-file", "blob", entry.objectId], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [bytes, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).bytes(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    return {
      failures: [`${context}: git index blob is unavailable: ${stderr.trim()}`],
      bytes: null,
    };
  }
  return { failures: [], bytes };
}

function sha256Bytes(bytes: Uint8Array): string {
  const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  return `${SHA256_PREFIX}${digest}`;
}

function sensitiveMarkerFailures(bytes: Uint8Array, context: string): string[] {
  const lines = new TextDecoder().decode(bytes).split("\n");
  const failures: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (containsSensitivePublicMarker(lines[index] ?? "")) {
      failures.push(`${context} contains a sensitive marker at line ${index + 1}`);
    }
  }
  return failures;
}

function decodedJsonSensitiveMarkerFailures(value: unknown, context: string): string[] {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (typeof candidate === "string") {
      if (containsSensitivePublicMarker(candidate)) {
        return [`${context} contains a sensitive marker after JSON decoding`];
      }
      continue;
    }
    if (Array.isArray(candidate)) {
      pending.push(...candidate);
      continue;
    }
    if (candidate !== null && typeof candidate === "object") {
      for (const [key, child] of Object.entries(candidate)) {
        pending.push(key, child);
      }
    }
  }
  return [];
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
  if (treeExitCode !== 0 || !/^100(?:644|755) blob [0-9a-f]{40,64}\t/.test(treeOutput)) {
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

export function extractGateDefinition(document: string, gateId: string): string | null {
  const normalizedDocument = document.replaceAll("\r\n", "\n");
  const escapedGateId = gateId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(`^### ${escapedGateId} — .+$`, "m").exec(normalizedDocument);
  if (!heading || heading.index === undefined) return null;
  const remainderStart = heading.index + heading[0].length;
  const remainder = normalizedDocument.slice(remainderStart);
  const nextHeadingOffset = remainder.search(/^#{1,3} /m);
  const end =
    nextHeadingOffset < 0 ? normalizedDocument.length : remainderStart + nextHeadingOffset;
  return `${normalizedDocument.slice(heading.index, end).trimEnd()}\n`;
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

async function writeProjectionUpdates(
  repoRoot: string,
  projectionUpdates: readonly ProjectionUpdate[],
  renameFile: RenameFile,
): Promise<void> {
  const nonce = crypto.randomUUID();
  const stagedUpdates: Array<ProjectionUpdate & { readonly temporaryPath: string }> = [];
  const appliedUpdates: Array<ProjectionUpdate & { readonly temporaryPath: string }> = [];
  try {
    for (const update of projectionUpdates) {
      if (update.current === update.expected) continue;
      const targetPath = resolve(repoRoot, update.path);
      const temporaryPath = `${targetPath}.model-policy-${nonce}.tmp`;
      await Bun.write(temporaryPath, update.expected);
      await chmod(temporaryPath, (await lstat(targetPath)).mode & 0o777);
      stagedUpdates.push({ ...update, temporaryPath });
    }
    try {
      for (const update of stagedUpdates) {
        await renameFile(update.temporaryPath, resolve(repoRoot, update.path));
        appliedUpdates.push(update);
      }
    } catch (error) {
      const rollbackFailures: string[] = [];
      for (const update of appliedUpdates.reverse()) {
        const targetPath = resolve(repoRoot, update.path);
        const rollbackPath = `${targetPath}.model-policy-${nonce}.rollback`;
        try {
          await Bun.write(rollbackPath, update.current);
          await chmod(rollbackPath, (await lstat(targetPath)).mode & 0o777);
          await rename(rollbackPath, targetPath);
        } catch (rollbackError) {
          rollbackFailures.push(
            rollbackError instanceof Error ? rollbackError.message : "unknown rollback failure",
          );
        } finally {
          await unlink(rollbackPath).catch(() => undefined);
        }
      }
      const message = error instanceof Error ? error.message : "unknown projection write failure";
      if (rollbackFailures.length > 0) {
        throw new Error(`${message}; rollback failed: ${rollbackFailures.join("; ")}`);
      }
      throw error;
    }
  } finally {
    await Promise.all(
      stagedUpdates.map((update) => unlink(update.temporaryPath).catch(() => undefined)),
    );
  }
}

interface OperationalEvidenceExpectation {
  readonly kind: OperationalEvidenceKind;
  readonly context: string;
  readonly path: string;
  readonly sha256: string;
}

async function validateOperationalEvidenceReference(
  repoRoot: string,
  phase: ProductPhase,
  gate: ProductPhaseGate,
  record: EvidenceRecord,
  expectation: OperationalEvidenceExpectation,
  trackedIndex: ReadonlyMap<string, TrackedIndexEntry>,
  validateOperationalEvidence: ValidateFunction,
  operationalEvidenceIds: Map<string, string>,
): Promise<string[]> {
  const failures: string[] = [];
  const artifactBlob = await readTrackedRegularBlob(
    repoRoot,
    expectation.path,
    trackedIndex,
    expectation.context,
  );
  failures.push(...artifactBlob.failures);
  if (!artifactBlob.bytes) return failures;
  if (sha256Bytes(artifactBlob.bytes) !== expectation.sha256) {
    failures.push(`${expectation.context}: digest mismatch for ${expectation.path}`);
    return failures;
  }
  const markerFailures = sensitiveMarkerFailures(artifactBlob.bytes, expectation.context);
  failures.push(...markerFailures);
  if (markerFailures.length > 0) return failures;

  let unknownArtifact: unknown;
  try {
    unknownArtifact = JSON.parse(new TextDecoder().decode(artifactBlob.bytes));
  } catch {
    failures.push(`${expectation.context}: operational evidence is not valid JSON`);
    return failures;
  }
  const decodedMarkerFailures = decodedJsonSensitiveMarkerFailures(
    unknownArtifact,
    expectation.context,
  );
  failures.push(...decodedMarkerFailures);
  if (decodedMarkerFailures.length > 0) return failures;
  if (!validateOperationalEvidence(unknownArtifact)) {
    failures.push(
      `${expectation.context}: operational evidence schema rejected: ` +
        validationErrors(validateOperationalEvidence.errors),
    );
    return failures;
  }
  const artifact = unknownArtifact as OperationalEvidence;
  const priorPath = operationalEvidenceIds.get(artifact.operationalEvidenceId);
  if (priorPath && priorPath !== expectation.path) {
    failures.push(
      `${expectation.context}: operational evidence id ${artifact.operationalEvidenceId} ` +
        `is already bound to ${priorPath}`,
    );
  } else {
    operationalEvidenceIds.set(artifact.operationalEvidenceId, expectation.path);
  }
  if (artifact.kind !== expectation.kind) {
    failures.push(`${expectation.context}: operational evidence kind mismatch`);
  }
  if (
    artifact.phaseId !== phase.id ||
    artifact.gateId !== gate.id ||
    artifact.evidenceId !== record.evidenceId ||
    artifact.deploymentIdentity !== record.serviceObservation?.deploymentIdentity
  ) {
    failures.push(`${expectation.context}: evidence, gate, or deployment binding mismatch`);
  }
  if (
    artifact.windowStartedAt !== record.serviceObservation?.windowStartedAt ||
    artifact.windowEndedAt !== record.serviceObservation?.windowEndedAt
  ) {
    failures.push(`${expectation.context}: authorized observation window mismatch`);
  }

  const artifactRecordedAt = Date.parse(artifact.recordedAt);
  const recordRecordedAt = Date.parse(record.recordedAt);
  if (artifactRecordedAt > recordRecordedAt) {
    failures.push(`${expectation.context}: artifact cannot postdate the evidence record`);
  }
  if (artifact.kind === "deployment_authorization") {
    const windowStartedAt = Date.parse(artifact.windowStartedAt);
    if (artifactRecordedAt >= windowStartedAt) {
      failures.push(`${expectation.context}: authorization must predate the observed window`);
    }
  } else if (artifact.observedAt) {
    const observedAt = Date.parse(artifact.observedAt);
    const windowStartedAt = Date.parse(artifact.windowStartedAt);
    const windowEndedAt = Date.parse(artifact.windowEndedAt);
    if (observedAt < windowStartedAt || observedAt > windowEndedAt) {
      failures.push(`${expectation.context}: observation instant is outside the bound window`);
    }
    if (artifactRecordedAt < observedAt) {
      failures.push(`${expectation.context}: artifact record predates its observation`);
    }
  }
  return failures;
}

async function validateEvidenceReference(
  repoRoot: string,
  phase: ProductPhase,
  gate: ProductPhaseGate,
  reference: EvidenceReference,
  trackedIndex: ReadonlyMap<string, TrackedIndexEntry>,
  validateEvidenceRecord: ValidateFunction,
  validateReviewAttestation: ValidateFunction,
  validateOperationalEvidence: ValidateFunction,
  evidenceIds: Map<string, string>,
  reviewIds: Map<string, string>,
  operationalEvidenceIds: Map<string, string>,
  currentGateDefinitionSha256: string,
): Promise<string[]> {
  const failures: string[] = [];
  if (!isAllowedEvidenceRecordPath(reference.record)) {
    return [`${gate.id}: evidence record path is outside ${EVIDENCE_RECORD_PREFIX}`];
  }
  const evidenceBlob = await readTrackedRegularBlob(
    repoRoot,
    reference.record,
    trackedIndex,
    `${gate.id}: evidence`,
  );
  failures.push(...evidenceBlob.failures);
  if (!evidenceBlob.bytes) return failures;
  if (sha256Bytes(evidenceBlob.bytes) !== reference.sha256) {
    failures.push(`${gate.id}: evidence record digest mismatch for ${reference.record}`);
    return failures;
  }
  const markerFailures = sensitiveMarkerFailures(evidenceBlob.bytes, `${gate.id}: evidence`);
  failures.push(...markerFailures);
  if (markerFailures.length > 0) return failures;

  let unknownRecord: unknown;
  try {
    unknownRecord = JSON.parse(new TextDecoder().decode(evidenceBlob.bytes));
  } catch {
    failures.push(`${gate.id}: evidence record is not valid JSON`);
    return failures;
  }
  const decodedRecordMarkerFailures = decodedJsonSensitiveMarkerFailures(
    unknownRecord,
    `${gate.id}: evidence`,
  );
  failures.push(...decodedRecordMarkerFailures);
  if (decodedRecordMarkerFailures.length > 0) return failures;
  if (!validateEvidenceRecord(unknownRecord)) {
    failures.push(
      `${gate.id}: evidence schema rejected ${reference.record}: ` +
        validationErrors(validateEvidenceRecord.errors),
    );
    return failures;
  }
  const record = unknownRecord as EvidenceRecord;
  const priorEvidencePath = evidenceIds.get(record.evidenceId);
  if (priorEvidencePath && priorEvidencePath !== reference.record) {
    failures.push(
      `${gate.id}: evidence id ${record.evidenceId} is already bound to ${priorEvidencePath}`,
    );
  } else {
    evidenceIds.set(record.evidenceId, reference.record);
  }
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

  let candidatePhaseDocument: Uint8Array | null = null;
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
    if (artifact.path === phase.document) candidatePhaseDocument = bytes;
  }
  if (!candidatePhaseDocument) {
    failures.push(`${gate.id}: evidence does not bind the gate-definition document`);
  } else {
    const candidateGateDefinition = extractGateDefinition(
      new TextDecoder().decode(candidatePhaseDocument),
      gate.id,
    );
    if (!candidateGateDefinition) {
      failures.push(`${gate.id}: candidate phase document does not define the gate`);
    } else if (
      sha256Bytes(new TextEncoder().encode(candidateGateDefinition)) !== record.gateDefinitionSha256
    ) {
      failures.push(`${gate.id}: gate definition digest does not match the source commit`);
    }
  }
  if (record.gateDefinitionSha256 !== currentGateDefinitionSha256) {
    failures.push(`${gate.id}: gate definition digest does not match the current indexed document`);
  }
  for (const input of record.inputIdentities) {
    if (input.kind !== "repository_fixture") continue;
    if (!input.path) {
      failures.push(`${gate.id}: repository fixture ${input.identifier} lacks a path`);
      continue;
    }
    const bytes = await blobAtCommit(repoRoot, record.sourceCommit, input.path);
    if (bytes === null) {
      failures.push(
        `${gate.id}: repository fixture ${input.path} is not a regular file at ${record.sourceCommit}`,
      );
      continue;
    }
    if (sha256Bytes(bytes) !== input.sha256) {
      failures.push(`${gate.id}: repository fixture digest mismatch for ${input.path}`);
    }
  }

  const reviewRoles = new Set<ReviewRole>();
  const reviewerRefs = new Set<string>();
  for (const binding of record.reviewBindings) {
    if (reviewRoles.has(binding.role)) {
      failures.push(`${gate.id}: duplicate ${binding.role} review binding`);
    }
    reviewRoles.add(binding.role);
    if (reviewerRefs.has(binding.reviewerRef)) {
      failures.push(`${gate.id}: reviewer ref must be role-separated for ${binding.role}`);
    }
    reviewerRefs.add(binding.reviewerRef);
    if (binding.reviewerRef === record.evidenceProducerRef) {
      failures.push(`${gate.id}: ${binding.role} reviewer must differ from evidence producer`);
    }
    if (!isAllowedReviewAttestationPath(binding.attestationRecord)) {
      failures.push(`${gate.id}: review attestation path is outside ${REVIEW_ATTESTATION_PREFIX}`);
      continue;
    }
    const attestationContext = `${gate.id}: ${binding.role} review attestation`;
    const attestationBlob = await readTrackedRegularBlob(
      repoRoot,
      binding.attestationRecord,
      trackedIndex,
      attestationContext,
    );
    failures.push(...attestationBlob.failures);
    if (!attestationBlob.bytes) continue;
    if (sha256Bytes(attestationBlob.bytes) !== binding.sha256) {
      failures.push(`${attestationContext}: digest mismatch`);
      continue;
    }
    const attestationMarkerFailures = sensitiveMarkerFailures(
      attestationBlob.bytes,
      attestationContext,
    );
    failures.push(...attestationMarkerFailures);
    if (attestationMarkerFailures.length > 0) continue;

    let unknownAttestation: unknown;
    try {
      unknownAttestation = JSON.parse(new TextDecoder().decode(attestationBlob.bytes));
    } catch {
      failures.push(`${attestationContext}: record is not valid JSON`);
      continue;
    }
    const decodedAttestationMarkerFailures = decodedJsonSensitiveMarkerFailures(
      unknownAttestation,
      attestationContext,
    );
    failures.push(...decodedAttestationMarkerFailures);
    if (decodedAttestationMarkerFailures.length > 0) continue;
    if (!validateReviewAttestation(unknownAttestation)) {
      failures.push(
        `${attestationContext}: schema rejected: ` +
          validationErrors(validateReviewAttestation.errors),
      );
      continue;
    }
    const attestation = unknownAttestation as ReviewAttestation;
    const priorAttestationPath = reviewIds.get(attestation.reviewId);
    if (priorAttestationPath && priorAttestationPath !== binding.attestationRecord) {
      failures.push(
        `${attestationContext}: review id ${attestation.reviewId} is already bound to ${priorAttestationPath}`,
      );
    } else {
      reviewIds.set(attestation.reviewId, binding.attestationRecord);
    }
    if (
      attestation.phaseId !== phase.id ||
      attestation.gateId !== gate.id ||
      attestation.candidateCommit !== record.sourceCommit ||
      attestation.role !== binding.role ||
      attestation.reviewerRef !== binding.reviewerRef
    ) {
      failures.push(`${attestationContext}: candidate, gate, role, or reviewer binding mismatch`);
    }
    if (
      attestation.verdict !== "approve" &&
      attestation.verdict !== "approve_with_minor_reservations"
    ) {
      failures.push(`${attestationContext}: verdict does not approve the gate`);
    }
    if (attestation.findings.blocking.length > 0 || attestation.findings.major.length > 0) {
      failures.push(`${attestationContext}: retains blocking or major findings`);
    }
    if (!isAllowedReviewPath(attestation.reportPath)) {
      failures.push(`${attestationContext}: report path is outside ${REVIEW_PREFIX}`);
      continue;
    }
    const reportBlob = await readTrackedRegularBlob(
      repoRoot,
      attestation.reportPath,
      trackedIndex,
      `${attestationContext}: report`,
    );
    failures.push(...reportBlob.failures);
    if (reportBlob.bytes && sha256Bytes(reportBlob.bytes) !== attestation.reportSha256) {
      failures.push(`${attestationContext}: report digest mismatch`);
    }
    if (reportBlob.bytes) {
      failures.push(...sensitiveMarkerFailures(reportBlob.bytes, `${attestationContext}: report`));
    }
  }

  if (EVIDENCE_LEVEL_RANK[record.achievedEvidenceLevel] >= EVIDENCE_LEVEL_RANK.qualified) {
    for (const requiredRole of phase.requiredIndependentReviewRoles) {
      if (!reviewRoles.has(requiredRole)) {
        failures.push(`${gate.id}: missing required independent ${requiredRole} review`);
      }
    }
    if (record.verdict !== "approve" && record.verdict !== "approve_with_minor_reservations") {
      failures.push(`${gate.id}: qualified evidence verdict does not approve the gate`);
    }
    if (record.findings.blocking.length > 0 || record.findings.major.length > 0) {
      failures.push(`${gate.id}: qualified evidence retains blocking or major findings`);
    }
  }

  if (record.serviceObservation) {
    const startedAt = Date.parse(record.serviceObservation.windowStartedAt);
    const endedAt = Date.parse(record.serviceObservation.windowEndedAt);
    const recordedAt = Date.parse(record.recordedAt);
    if (startedAt >= endedAt) {
      failures.push(`${gate.id}: service observation window must end after it starts`);
    }
    if (endedAt > recordedAt) {
      failures.push(`${gate.id}: service observation window cannot end after the evidence record`);
    }
    if (
      !record.inputIdentities.some(
        (input) =>
          input.kind === "operated_environment" &&
          input.identifier === record.serviceObservation?.deploymentIdentity,
      )
    ) {
      failures.push(`${gate.id}: service observation is not bound to its operated environment`);
    }
    const operationalEvidence: OperationalEvidenceExpectation[] = [
      {
        kind: "deployment_authorization",
        context: `${gate.id}: deployment authorization`,
        path: record.serviceObservation.authorizationEvidencePath,
        sha256: record.serviceObservation.authorizationEvidenceSha256,
      },
      {
        kind: "smoke_test",
        context: `${gate.id}: smoke test`,
        path: record.serviceObservation.smokeEvidencePath,
        sha256: record.serviceObservation.smokeEvidenceSha256,
      },
      {
        kind: "rollback_test",
        context: `${gate.id}: rollback test`,
        path: record.serviceObservation.rollbackEvidencePath,
        sha256: record.serviceObservation.rollbackEvidenceSha256,
      },
      ...record.serviceObservation.incidentEvidence.map((evidence) => ({
        kind: "incident_report" as const,
        context: `${gate.id}: incident report ${evidence.path}`,
        path: evidence.path,
        sha256: evidence.sha256,
      })),
    ];
    if (
      new Set(operationalEvidence.map((evidence) => evidence.path)).size !==
      operationalEvidence.length
    ) {
      failures.push(`${gate.id}: operational evidence paths must be distinct`);
    }
    for (const evidence of operationalEvidence) {
      failures.push(
        ...(await validateOperationalEvidenceReference(
          repoRoot,
          phase,
          gate,
          record,
          evidence,
          trackedIndex,
          validateOperationalEvidence,
          operationalEvidenceIds,
        )),
      );
    }
  }
  return failures;
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

  let trackedIndex: Map<string, TrackedIndexEntry>;
  try {
    trackedIndex = await loadTrackedIndex(repoRoot);
  } catch (error) {
    return [error instanceof Error ? error.message : "Unable to load tracked paths"];
  }

  const indexedJsonPaths = {
    roadmapSchema: "docs/apps/model-policy/phases.v1.schema.json",
    evidenceSchema: "docs/apps/model-policy/evidence-record.v1.schema.json",
    reviewAttestationSchema: "docs/apps/model-policy/review-attestation.v1.schema.json",
    operationalEvidenceSchema: "docs/apps/model-policy/operational-evidence.v1.schema.json",
    roadmap: "docs/apps/model-policy/phases.v1.json",
  } as const;
  const [
    roadmapSchemaBlob,
    evidenceSchemaBlob,
    reviewAttestationSchemaBlob,
    operationalEvidenceSchemaBlob,
    roadmapBlob,
  ] = await Promise.all([
    readTrackedRegularBlob(
      repoRoot,
      indexedJsonPaths.roadmapSchema,
      trackedIndex,
      `Model Policy plan ${indexedJsonPaths.roadmapSchema}`,
    ),
    readTrackedRegularBlob(
      repoRoot,
      indexedJsonPaths.evidenceSchema,
      trackedIndex,
      `Model Policy plan ${indexedJsonPaths.evidenceSchema}`,
    ),
    readTrackedRegularBlob(
      repoRoot,
      indexedJsonPaths.reviewAttestationSchema,
      trackedIndex,
      `Model Policy plan ${indexedJsonPaths.reviewAttestationSchema}`,
    ),
    readTrackedRegularBlob(
      repoRoot,
      indexedJsonPaths.operationalEvidenceSchema,
      trackedIndex,
      `Model Policy plan ${indexedJsonPaths.operationalEvidenceSchema}`,
    ),
    readTrackedRegularBlob(
      repoRoot,
      indexedJsonPaths.roadmap,
      trackedIndex,
      `Model Policy plan ${indexedJsonPaths.roadmap}`,
    ),
  ]);
  const indexedJsonFailures = [
    ...roadmapSchemaBlob.failures,
    ...evidenceSchemaBlob.failures,
    ...reviewAttestationSchemaBlob.failures,
    ...operationalEvidenceSchemaBlob.failures,
    ...roadmapBlob.failures,
  ];
  if (indexedJsonFailures.length > 0) return indexedJsonFailures;
  if (
    !roadmapSchemaBlob.bytes ||
    !evidenceSchemaBlob.bytes ||
    !reviewAttestationSchemaBlob.bytes ||
    !operationalEvidenceSchemaBlob.bytes ||
    !roadmapBlob.bytes
  ) {
    return ["Model Policy plan indexed JSON blobs are unavailable"];
  }

  let roadmapSchema: unknown;
  let evidenceSchema: unknown;
  let reviewAttestationSchema: unknown;
  let operationalEvidenceSchema: unknown;
  let unknownRoadmap: unknown;
  try {
    roadmapSchema = JSON.parse(new TextDecoder().decode(roadmapSchemaBlob.bytes));
    evidenceSchema = JSON.parse(new TextDecoder().decode(evidenceSchemaBlob.bytes));
    reviewAttestationSchema = JSON.parse(
      new TextDecoder().decode(reviewAttestationSchemaBlob.bytes),
    );
    operationalEvidenceSchema = JSON.parse(
      new TextDecoder().decode(operationalEvidenceSchemaBlob.bytes),
    );
    unknownRoadmap = JSON.parse(new TextDecoder().decode(roadmapBlob.bytes));
  } catch (error) {
    return [
      error instanceof Error
        ? `Model Policy plan JSON read failed: ${error.message}`
        : "Model Policy plan JSON read failed",
    ];
  }

  let validateRoadmap: ValidateFunction;
  let validateEvidenceRecord: ValidateFunction;
  let validateReviewAttestation: ValidateFunction;
  let validateOperationalEvidence: ValidateFunction;
  try {
    validateRoadmap = ajv.compile(checkedSchema(roadmapSchema, "Roadmap schema"));
    validateEvidenceRecord = ajv.compile(checkedSchema(evidenceSchema, "Evidence schema"));
    validateReviewAttestation = ajv.compile(
      checkedSchema(reviewAttestationSchema, "Review attestation schema"),
    );
    validateOperationalEvidence = ajv.compile(
      checkedSchema(operationalEvidenceSchema, "Operational evidence schema"),
    );
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

  const evidenceIds = new Map<string, string>();
  const reviewIds = new Map<string, string>();
  const operationalEvidenceIds = new Map<string, string>();
  for (const phase of roadmap.phases) {
    if (!isAllowedPhaseDocument(phase.document)) {
      failures.push(`${phase.id}: phase document path is outside ${PHASE_DOCUMENT_PREFIX}`);
      continue;
    }
    const phaseDocumentBlob = await readTrackedRegularBlob(
      repoRoot,
      phase.document,
      trackedIndex,
      phase.id,
    );
    failures.push(...phaseDocumentBlob.failures);
    if (!phaseDocumentBlob.bytes) continue;
    const content = new TextDecoder().decode(phaseDocumentBlob.bytes);
    if (!content.startsWith(`# ${phase.id} —`)) {
      failures.push(`${phase.document}: title must start with ${phase.id}`);
    }
    failures.push(...compareGateDefinitions(phase, content));
    for (const gate of phase.gates) {
      const currentGateDefinition = extractGateDefinition(content, gate.id);
      if (!currentGateDefinition) continue;
      const currentGateDefinitionSha256 = sha256Bytes(
        new TextEncoder().encode(currentGateDefinition),
      );
      for (const reference of gate.evidence) {
        failures.push(
          ...(await validateEvidenceReference(
            repoRoot,
            phase,
            gate,
            reference,
            trackedIndex,
            validateEvidenceRecord,
            validateReviewAttestation,
            validateOperationalEvidence,
            evidenceIds,
            reviewIds,
            operationalEvidenceIds,
            currentGateDefinitionSha256,
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
    try {
      await writeProjectionUpdates(repoRoot, projectionUpdates, options.projectionRename ?? rename);
    } catch (error) {
      return [
        error instanceof Error
          ? `Model Policy projection write failed: ${error.message}`
          : "Model Policy projection write failed",
      ];
    }
  }
  options.onValidatedSummary?.({
    phaseCount: roadmap.phases.length,
    gateCount: roadmap.phases.flatMap((phase) => phase.gates).length,
  });
  return [];
}

async function run(): Promise<void> {
  const write = Bun.argv.includes("--write");
  const summary: { value: ProductPhaseSummary | null } = { value: null };
  const failures = await checkProductPhaseFiles({
    write,
    onValidatedSummary: (validatedSummary) => {
      summary.value = validatedSummary;
    },
  });
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exitCode = 1;
    return;
  }
  if (!summary.value) {
    console.error("Model Policy phase plan validated without a summary");
    process.exitCode = 1;
    return;
  }
  console.log(
    `Model Policy phase plan verified: ${summary.value.phaseCount} phases, ` +
      `${summary.value.gateCount} gates`,
  );
}

if (import.meta.main) await run();
