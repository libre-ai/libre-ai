import { loadCanonicalContractRegistry } from "@libre-ai/contracts";

export type ArtifactKind = "build" | "dataset" | "export" | "release" | "evidence";
export type EvidenceStatus = "pass" | "fail" | "indeterminate";

export interface ArtifactReference {
  id: string;
  digest: string;
  mediaType: string;
}

export interface ArtifactFile {
  path: string;
  size: number;
  digest: string;
  mediaType: string;
}

export interface ArtifactManifest {
  schemaVersion: "libre-ai.artifact-manifest.v1";
  id: string;
  artifactType: ArtifactKind;
  createdAt: string;
  digest: string;
  files: ArtifactFile[];
  evidenceReport?: ArtifactReference;
}

export interface InputFile {
  path: string;
  bytes: Uint8Array;
  mediaType: string;
}

export interface EvidenceCheck {
  id: string;
  status: EvidenceStatus;
  ruleVersion: string;
  evidence?: ArtifactReference;
  reasonCode?: string;
}

export interface EvidenceProducer {
  name: string;
  version: string;
}

export interface EvidenceReport {
  schemaVersion: "libre-ai.evidence-report.v1";
  id: string;
  subject: string;
  subjectDigest: string;
  status: EvidenceStatus;
  checks: EvidenceCheck[];
  generatedAt: string;
  producer: EvidenceProducer;
}

export interface QualificationSummary {
  artifactId: string;
  artifactDigest: string;
  evidenceId: string;
  evidenceDigest: string;
  status: "pass";
}

export type QualificationResult =
  | { ok: true; summary: QualificationSummary }
  | {
      ok: false;
      code: string;
      path?: string;
    };

const contracts = loadCanonicalContractRegistry();

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compare(left, right))
      .map(([key, nested]) => [key, sortJson(nested)]),
  );
}

export function canonicalJson(value: unknown): string {
  const encoded = JSON.stringify(sortJson(value));
  if (encoded === undefined) throw new TypeError("Value is not JSON serializable");
  return encoded;
}

function sha256(bytes: string | Uint8Array): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(bytes);
  return hasher.digest("hex");
}

function safePath(path?: string): string | undefined {
  return path?.startsWith("/") ? path : undefined;
}

function validPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.includes("\\") &&
    !path.includes(":") &&
    ![...path].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 31 || codePoint > 126);
    }) &&
    !path.split("/").some((segment) => !segment || segment === "." || segment === "..")
  );
}

function fileDescriptors(files: readonly InputFile[]): ArtifactFile[] {
  if (files.length === 0) throw new EvidenceBuildError("artifact.files_empty");
  const descriptors = files.map((file) => {
    if (!validPath(file.path)) throw new EvidenceBuildError("artifact.path_invalid", "/files");
    return {
      path: file.path,
      size: file.bytes.byteLength,
      digest: sha256(file.bytes),
      mediaType: file.mediaType,
    };
  });
  descriptors.sort((left, right) => compare(left.path, right.path));
  for (let index = 1; index < descriptors.length; index += 1) {
    if (descriptors[index - 1]?.path === descriptors[index]?.path) {
      throw new EvidenceBuildError("artifact.file_duplicate", "/files");
    }
  }
  return descriptors;
}

export function contentDigest(files: readonly InputFile[]): string {
  return sha256(canonicalJson(fileDescriptors(files)));
}

class EvidenceBuildError extends Error {
  constructor(
    readonly code: string,
    readonly path?: string,
  ) {
    super(code);
    this.name = "EvidenceBuildError";
  }
}

function derivedStatus(checks: readonly EvidenceCheck[]): EvidenceStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "indeterminate")) return "indeterminate";
  return "pass";
}

export async function buildEvidenceReport(input: {
  id: string;
  subject: string;
  subjectDigest: string;
  generatedAt: string;
  producer: EvidenceProducer;
  checks: EvidenceCheck[];
}): Promise<EvidenceReport> {
  const checks = structuredClone(input.checks).sort((left, right) => compare(left.id, right.id));
  for (let index = 1; index < checks.length; index += 1) {
    if (checks[index - 1]?.id === checks[index]?.id) {
      throw new EvidenceBuildError("evidence.check_duplicate", "/checks");
    }
  }
  const report: EvidenceReport = {
    schemaVersion: "libre-ai.evidence-report.v1",
    id: input.id,
    subject: input.subject,
    subjectDigest: input.subjectDigest,
    status: derivedStatus(checks),
    checks,
    generatedAt: input.generatedAt,
    producer: structuredClone(input.producer),
  };
  const result = (await contracts).validate("evidence-report.v1.schema.json", report);
  if (!result.ok) {
    throw new EvidenceBuildError(
      "evidence.schema_invalid",
      safePath(result.issues[0]?.instancePath),
    );
  }
  return report;
}

export function evidenceReference(report: EvidenceReport): ArtifactReference {
  return {
    id: report.id,
    digest: sha256(canonicalJson(report)),
    mediaType: "application/json",
  };
}

export async function buildArtifactManifest(input: {
  id: string;
  artifactType: ArtifactKind;
  createdAt: string;
  files: InputFile[];
  evidenceReport?: ArtifactReference;
}): Promise<ArtifactManifest> {
  if (
    (input.artifactType === "build" || input.artifactType === "release") &&
    !input.evidenceReport
  ) {
    throw new EvidenceBuildError("artifact.evidence_required");
  }
  const files = fileDescriptors(input.files);
  const manifest: ArtifactManifest = {
    schemaVersion: "libre-ai.artifact-manifest.v1",
    id: input.id,
    artifactType: input.artifactType,
    createdAt: input.createdAt,
    digest: sha256(canonicalJson(files)),
    files,
    ...(input.evidenceReport ? { evidenceReport: structuredClone(input.evidenceReport) } : {}),
  };
  const result = (await contracts).validate("artifact-manifest.v1.schema.json", manifest);
  if (!result.ok) {
    throw new EvidenceBuildError(
      "artifact.schema_invalid",
      safePath(result.issues[0]?.instancePath),
    );
  }
  return manifest;
}

function failure(code: string, path?: string): QualificationResult {
  return { ok: false, code, ...(path ? { path } : {}) };
}

export async function verifyReleaseCandidate(input: {
  manifest: unknown;
  evidence: unknown;
  files: InputFile[];
}): Promise<QualificationResult> {
  const registry = await contracts;
  const manifestValidation = registry.validate("artifact-manifest.v1.schema.json", input.manifest);
  if (!manifestValidation.ok) {
    return failure("artifact.schema_invalid", safePath(manifestValidation.issues[0]?.instancePath));
  }
  const evidenceValidation = registry.validate("evidence-report.v1.schema.json", input.evidence);
  if (!evidenceValidation.ok) {
    return failure("evidence.schema_invalid", safePath(evidenceValidation.issues[0]?.instancePath));
  }
  const manifest = input.manifest as ArtifactManifest;
  const evidence = input.evidence as EvidenceReport;

  let descriptors: ArtifactFile[];
  try {
    descriptors = fileDescriptors(input.files);
  } catch (error) {
    if (error instanceof EvidenceBuildError) return failure(error.code, error.path);
    return failure("artifact.verification_failed");
  }
  const sortedManifestFiles = [...manifest.files].sort((left, right) =>
    compare(left.path, right.path),
  );
  if (canonicalJson(sortedManifestFiles) !== canonicalJson(manifest.files)) {
    return failure("artifact.files_not_sorted", "/files");
  }
  for (let index = 1; index < manifest.files.length; index += 1) {
    if (manifest.files[index - 1]?.path === manifest.files[index]?.path) {
      return failure("artifact.file_duplicate", "/files");
    }
  }
  if (sha256(canonicalJson(manifest.files)) !== manifest.digest) {
    return failure("artifact.manifest_digest_mismatch");
  }
  if (descriptors.length !== manifest.files.length)
    return failure("artifact.file_missing", "/files");
  for (let index = 0; index < descriptors.length; index += 1) {
    const actual = descriptors[index];
    const expected = manifest.files[index];
    if (!actual || !expected || actual.path !== expected.path) {
      return failure("artifact.file_unexpected", "/files");
    }
    if (actual.size !== expected.size) return failure("artifact.file_size_mismatch", "/files");
    if (actual.digest !== expected.digest)
      return failure("artifact.file_digest_mismatch", "/files");
    if (actual.mediaType !== expected.mediaType) {
      return failure("artifact.file_media_type_mismatch", "/files");
    }
  }
  if (manifest.artifactType !== "build" && manifest.artifactType !== "release") {
    return failure("evidence.artifact_kind_unqualified");
  }
  if (evidence.status !== "pass") return failure("evidence.report_not_passing");
  if (evidence.checks.some((check) => check.status !== "pass")) {
    return failure("evidence.status_inconsistent", "/checks");
  }
  const sortedChecks = [...evidence.checks].sort((left, right) => compare(left.id, right.id));
  for (let index = 1; index < sortedChecks.length; index += 1) {
    if (sortedChecks[index - 1]?.id === sortedChecks[index]?.id) {
      return failure("evidence.check_duplicate", "/checks");
    }
  }
  if (canonicalJson(sortedChecks) !== canonicalJson(evidence.checks)) {
    return failure("evidence.checks_not_canonical", "/checks");
  }
  if (evidence.subject !== manifest.id || evidence.subjectDigest !== manifest.digest) {
    return failure("evidence.subject_mismatch");
  }
  const reference = evidenceReference(evidence);
  if (
    !manifest.evidenceReport ||
    manifest.evidenceReport.id !== reference.id ||
    manifest.evidenceReport.digest !== reference.digest ||
    manifest.evidenceReport.mediaType !== reference.mediaType
  ) {
    return failure("evidence.reference_mismatch");
  }
  return {
    ok: true,
    summary: {
      artifactId: manifest.id,
      artifactDigest: manifest.digest,
      evidenceId: evidence.id,
      evidenceDigest: reference.digest,
      status: "pass",
    },
  };
}
