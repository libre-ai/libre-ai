import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildArtifactManifest,
  buildEvidenceReport,
  contentDigest,
  evidenceReference,
  type InputFile,
} from "../src/verification";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files: InputFile[] = [
  {
    path: "dist/app.js",
    mediaType: "text/javascript",
    bytes: new TextEncoder().encode("console.log('libre-ai');\n"),
  },
];
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
const fixture = {
  schemaVersion: "libre-ai.release-candidate-fixture.v1",
  files: files.map((file) => ({
    path: file.path,
    mediaType: file.mediaType,
    contentUtf8: new TextDecoder().decode(file.bytes),
  })),
  manifest,
  evidence,
};
const output = resolve(packageRoot, "fixtures/release-candidate.v1.json");
const rendered = `${JSON.stringify(fixture, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if ((await readFile(output, "utf8")) !== rendered) {
    console.error(`Golden release candidate differs: ${output}`);
    process.exit(1);
  }
  console.log(`Verified ${output}`);
} else {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, rendered);
  console.log(`Generated ${output}`);
}
