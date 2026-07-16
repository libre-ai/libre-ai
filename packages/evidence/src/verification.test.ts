import { describe, expect, test } from "bun:test";
import {
  buildArtifactManifest,
  buildEvidenceReport,
  canonicalJson,
  contentDigest,
  type EvidenceReport,
  evidenceReference,
  type InputFile,
  verifyReleaseCandidate,
} from "./verification";

type GoldenFixture = {
  files: Array<{ path: string; mediaType: string; contentUtf8: string }>;
  manifest: unknown;
  evidence: EvidenceReport;
};

const fixture = (await Bun.file(
  "packages/evidence/fixtures/release-candidate.v1.json",
).json()) as GoldenFixture;
const files: InputFile[] = fixture.files.map((file) => ({
  path: file.path,
  mediaType: file.mediaType,
  bytes: new TextEncoder().encode(file.contentUtf8),
}));

function first<T>(values: T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error("expected a non-empty fixture array");
  return value;
}

describe("release evidence", () => {
  test("regenerates the golden candidate byte identically", () => {
    const result = Bun.spawnSync({
      cmd: [process.execPath, "scripts/generate-golden.ts", "--check"],
      cwd: "packages/evidence",
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(result.exitCode).toBe(0);
  });

  test("qualifies the cross-runtime golden candidate", async () => {
    const result = await verifyReleaseCandidate({
      manifest: fixture.manifest,
      evidence: fixture.evidence,
      files,
    });
    expect(result).toEqual({
      ok: true,
      summary: {
        artifactId: "urn:libre-ai:artifact:release-golden",
        artifactDigest: "aa2bff8a1e3226873b2495393c27de44ada131091aded2b01692a66f0f19c5af",
        evidenceId: "urn:libre-ai:evidence:release-golden",
        evidenceDigest: "f7aca507c950554b2b71d1090275b24004de3eaaa8fa5086717bfde94dcc5a60",
        status: "pass",
      },
    });
  });

  test("builders reproduce golden output regardless of check order", async () => {
    const evidence = await buildEvidenceReport({
      id: "urn:libre-ai:evidence:release-golden",
      subject: "urn:libre-ai:artifact:release-golden",
      subjectDigest: contentDigest(files),
      generatedAt: "2026-07-16T00:00:00Z",
      producer: { name: "libre-ai-proof", version: "0.1.0" },
      checks: [
        { id: "supply-chain", status: "pass", ruleVersion: "1.0.0" },
        { id: "contracts", status: "pass", ruleVersion: "1.0.0" },
      ],
    });
    const manifest = await buildArtifactManifest({
      id: "urn:libre-ai:artifact:release-golden",
      artifactType: "release",
      createdAt: "2026-07-16T00:00:00Z",
      files,
      evidenceReport: evidenceReference(evidence),
    });
    expect(canonicalJson(evidence)).toBe(canonicalJson(fixture.evidence));
    expect(canonicalJson(manifest)).toBe(canonicalJson(fixture.manifest));

    await expect(
      buildEvidenceReport({
        id: "urn:libre-ai:evidence:duplicate",
        subject: "urn:libre-ai:artifact:release-golden",
        subjectDigest: contentDigest(files),
        generatedAt: "2026-07-16T00:00:00Z",
        producer: { name: "libre-ai-proof", version: "0.1.0" },
        checks: [
          { id: "same-check", status: "pass", ruleVersion: "1.0.0" },
          { id: "same-check", status: "pass", ruleVersion: "1.0.0" },
        ],
      }),
    ).rejects.toMatchObject({ code: "evidence.check_duplicate", path: "/checks" });
  });

  test("rejects hostile paths without echoing them", async () => {
    const hostile = "../private-value-must-not-leak\n";
    try {
      await buildArtifactManifest({
        id: "urn:libre-ai:artifact:dataset-1",
        artifactType: "dataset",
        createdAt: "2026-07-16T00:00:00Z",
        files: [
          { path: hostile, mediaType: "text/plain", bytes: new TextEncoder().encode("secret") },
        ],
      });
      throw new Error("hostile path accepted");
    } catch (error) {
      expect(error).toMatchObject({ code: "artifact.path_invalid", path: "/files" });
      expect(JSON.stringify(error)).not.toContain(hostile);
    }
  });

  test("rejects tampered bytes and never returns their content", async () => {
    const privateValue = "private-value-must-not-leak";
    const result = await verifyReleaseCandidate({
      manifest: fixture.manifest,
      evidence: fixture.evidence,
      files: [
        {
          ...first(files),
          bytes: new TextEncoder().encode(privateValue),
        },
      ],
    });
    expect(result).toMatchObject({ ok: false, code: "artifact.file_size_mismatch" });
    expect(JSON.stringify(result)).not.toContain(privateValue);
  });

  test("rejects a consistent failed report and an inconsistent passing report", async () => {
    const failed = structuredClone(fixture.evidence);
    failed.status = "fail";
    first(failed.checks).status = "fail";
    first(failed.checks).reasonCode = "proof.check_failed";
    const failedManifest = structuredClone(fixture.manifest) as Record<string, unknown>;
    failedManifest.evidenceReport = evidenceReference(failed);
    expect(
      await verifyReleaseCandidate({ manifest: failedManifest, evidence: failed, files }),
    ).toMatchObject({ ok: false, code: "evidence.report_not_passing" });

    const inconsistent = structuredClone(fixture.evidence);
    first(inconsistent.checks).status = "fail";
    first(inconsistent.checks).reasonCode = "proof.check_failed";
    expect(
      await verifyReleaseCandidate({
        manifest: fixture.manifest,
        evidence: inconsistent,
        files,
      }),
    ).toMatchObject({ ok: false, code: "evidence.schema_invalid" });
  });
});
