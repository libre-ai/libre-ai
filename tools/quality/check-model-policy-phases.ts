import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";

export type ProductPhaseStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "complete"
  | "superseded";
export type ProductPhaseGateStatus = "pending" | "passed" | "blocked";

export interface ProductPhaseGate {
  readonly id: string;
  status: ProductPhaseGateStatus;
  evidence: string[];
}

export interface ProductPhase {
  readonly id: string;
  readonly title: string;
  readonly outcome: string;
  readonly document: string;
  status: ProductPhaseStatus;
  dependsOn: string[];
  blockedBy: string[];
  gates: ProductPhaseGate[];
}

export interface ProductPhaseRoadmap {
  readonly schemaVersion: "libre-ai.model-policy-phases.v1";
  readonly authorityStatus: "proposed" | "accepted" | "superseded";
  readonly updatedAt: string;
  readonly currentPhase: string;
  readonly phases: ProductPhase[];
}

const START_MARKER = "<!-- model-policy-phases:start -->";
const END_MARKER = "<!-- model-policy-phases:end -->";
const STATUS_LABELS: Record<ProductPhaseStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  complete: "Complete",
  superseded: "Superseded",
};

function validationErrors(value: ErrorObject[] | null | undefined): string {
  return (value ?? [])
    .slice(0, 20)
    .map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`)
    .join("; ");
}

export function validateRoadmapSemantics(roadmap: ProductPhaseRoadmap): string[] {
  const failures: string[] = [];
  const phasesById = new Map<string, ProductPhase>();
  const gateIds = new Set<string>();

  for (const phase of roadmap.phases) {
    if (phasesById.has(phase.id)) failures.push(`${phase.id}: duplicate phase id`);
    phasesById.set(phase.id, phase);

    const passedGates = phase.gates.filter((gate) => gate.status === "passed");
    if (phase.status === "not_started" && passedGates.length > 0) {
      failures.push(`${phase.id}: not-started phase already has a passed gate`);
    }
    if (phase.status === "in_progress" && passedGates.length === 0) {
      failures.push(`${phase.id}: in-progress phase has no passed gate`);
    }
    if (phase.status === "blocked" && phase.blockedBy.length === 0) {
      failures.push(`${phase.id}: blocked phase has no named blocker`);
    }
    if (phase.status !== "blocked" && phase.blockedBy.length > 0) {
      failures.push(`${phase.id}: non-blocked phase carries blockers`);
    }
    if (phase.status === "complete" && phase.gates.some((gate) => gate.status !== "passed")) {
      failures.push(`${phase.id}: complete phase has a non-passed gate`);
    }

    for (const gate of phase.gates) {
      if (!gate.id.startsWith(`${phase.id}-G`)) {
        failures.push(`${gate.id}: gate id does not belong to ${phase.id}`);
      }
      if (gateIds.has(gate.id)) failures.push(`${gate.id}: duplicate gate id`);
      gateIds.add(gate.id);
      if (gate.status === "passed" && gate.evidence.length === 0) {
        failures.push(`${gate.id}: passed gate has no evidence`);
      }
      if (new Set(gate.evidence).size !== gate.evidence.length) {
        failures.push(`${gate.id}: duplicate evidence path`);
      }
    }
  }

  if (!phasesById.has(roadmap.currentPhase)) {
    failures.push(`${roadmap.currentPhase}: current phase does not exist`);
  } else {
    const currentStatus = phasesById.get(roadmap.currentPhase)?.status;
    if (currentStatus === "complete" || currentStatus === "superseded") {
      failures.push(`${roadmap.currentPhase}: current phase is not active`);
    }
  }

  for (const phase of roadmap.phases) {
    for (const dependencyId of phase.dependsOn) {
      if (!phasesById.has(dependencyId)) {
        failures.push(`${phase.id}: unknown dependency ${dependencyId}`);
      }
      if (dependencyId === phase.id) failures.push(`${phase.id}: self dependency`);
      if (phase.status === "complete" && phasesById.get(dependencyId)?.status !== "complete") {
        failures.push(`${phase.id}: completed before dependency ${dependencyId}`);
      }
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

export function renderReadmeProjection(
  roadmap: ProductPhaseRoadmap,
  documentPrefix = "../../",
): string {
  const lines = [
    `Roadmap authority: [\`phases.v1.json\`](${documentPrefix}docs/apps/model-policy/phases.v1.json) (` +
      `\`${roadmap.authorityStatus}\`).`,
    "",
    "| Phase | Outcome | Status | Gates | Detail |",
    "| --- | --- | --- | ---: | --- |",
  ];
  for (const phase of roadmap.phases) {
    const passed = phase.gates.filter((gate) => gate.status === "passed").length;
    lines.push(
      `| ${phase.id} · ${phase.title} | ${phase.outcome} | ${STATUS_LABELS[phase.status]} | ` +
        `${passed}/${phase.gates.length} | [Phase record](${documentPrefix}${phase.document}) |`,
    );
  }
  lines.push(
    "",
    "A phase is complete only when every mandatory gate links to immutable evidence. " +
      "This proposed product roadmap grants no implementation, deployment, or compliance authority.",
  );
  return lines.join("\n");
}

export function replaceReadmeProjection(source: string, projection: string): string {
  const startCount = source.split(START_MARKER).length - 1;
  const endCount = source.split(END_MARKER).length - 1;
  if (startCount !== 1 || endCount !== 1) {
    throw new Error("README phase projection markers must occur exactly once");
  }
  const startIndex = source.indexOf(START_MARKER);
  const endIndex = source.indexOf(END_MARKER);
  if (startIndex > endIndex) {
    throw new Error("README phase projection markers are reversed");
  }
  const before = source.slice(0, startIndex + START_MARKER.length);
  const after = source.slice(endIndex);
  return `${before}\n${projection}\n${after}`;
}

async function run(): Promise<void> {
  const failures: string[] = [];
  const schema = await Bun.file("docs/apps/model-policy/phases.v1.schema.json").json();
  const roadmap = (await Bun.file(
    "docs/apps/model-policy/phases.v1.json",
  ).json()) as ProductPhaseRoadmap;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(roadmap)) {
    failures.push(`Model Policy phase schema rejected: ${validationErrors(validate.errors)}`);
  }
  failures.push(...validateRoadmapSemantics(roadmap));

  for (const phase of roadmap.phases) {
    const phaseFile = Bun.file(phase.document);
    if (!(await phaseFile.exists())) {
      failures.push(`${phase.id}: missing phase document ${phase.document}`);
      continue;
    }
    const content = await phaseFile.text();
    if (!content.startsWith(`# ${phase.id} —`)) {
      failures.push(`${phase.document}: title must start with ${phase.id}`);
    }
    for (const gate of phase.gates) {
      if (!content.includes(`### ${gate.id} —`)) {
        failures.push(`${phase.document}: missing gate definition ${gate.id}`);
      }
      for (const evidencePath of gate.evidence) {
        if (!(await Bun.file(evidencePath).exists())) {
          failures.push(`${gate.id}: missing evidence ${evidencePath}`);
        }
      }
    }
  }

  const readmePath = "apps/model-policy/README.md";
  const readme = await Bun.file(readmePath).text();
  const projection = renderReadmeProjection(roadmap);
  let expectedReadme: string;
  try {
    expectedReadme = replaceReadmeProjection(readme, projection);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "README projection failed");
    expectedReadme = readme;
  }
  if (Bun.argv.includes("--write") && expectedReadme !== readme) {
    await Bun.write(readmePath, expectedReadme);
  } else if (expectedReadme !== readme) {
    failures.push(`${readmePath}: generated phase projection is stale; run checker with --write`);
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }
  console.log(
    `Model Policy roadmap verified: ${roadmap.phases.length} phases, ` +
      `${roadmap.phases.flatMap((phase) => phase.gates).length} gates`,
  );
}

if (import.meta.main) await run();
