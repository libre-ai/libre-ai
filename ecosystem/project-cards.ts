import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";

/**
 * γ phase 3.2 — the project-card system (design §6, ADR-0020).
 *
 * A card (`project.v1.yaml`) is the single state authority of a project:
 * mission statement in plain language, scope and non-goals, dependencies,
 * maturity ≠ progress ≠ confidence ≠ freshness, and phases whose exit
 * criteria carry integer weights and dated evidence. Progress is COMPUTED
 * from accepted criteria with evidence — the schema has no percent field by
 * construction, and an unstable scope reports « Avancement non calculable —
 * périmètre à clarifier » instead of a ratio (information, not a defect).
 *
 * This module is built in the hub and migrates to `governance` with the rest
 * of the ecosystem tooling (ADR-0020 §3).
 */

const schema = (await Bun.file(
  new URL("./schemas/project.v1.schema.json", import.meta.url).pathname,
).json()) as object;

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function safeError(error: ErrorObject): string {
  const message = error.message ?? "invalid";
  return `${error.instancePath || "/"}: ${message} (${error.keyword})`;
}

export function validateCard(value: unknown): string[] {
  if (validate(value)) return [];
  const errors = (validate.errors ?? []).map(safeError);
  // Ajv reports a failed if/then as a bare "must match then schema" on the
  // criterion; make the accepted-without-evidence case name its rule.
  return errors.map((error) =>
    error.includes('"then"') || error.includes("then")
      ? `${error} — an accepted criterion requires dated evidence`
      : error,
  );
}

interface ExitCriterion {
  readonly id: string;
  readonly weight: number;
  readonly status: "pending" | "accepted";
  readonly evidence?: { readonly date: string; readonly reference: string };
}

interface Phase {
  readonly id: string;
  readonly exit_criteria: readonly ExitCriterion[];
}

interface CardShape {
  readonly scope_stability: "stable" | "unstable";
  readonly phases: readonly Phase[];
  readonly maturity: string;
  readonly confidence: string;
  readonly exposure: string;
  readonly freshness: { readonly last_verified_on: string };
  readonly project: string;
}

export interface PhaseProgress {
  readonly id: string;
  readonly accepted_weight: number;
  readonly applicable_weight: number;
  readonly ratio: number;
}

export type ProgressReport =
  | {
      readonly computable: true;
      readonly phases: readonly PhaseProgress[];
      readonly overall_ratio: number;
      readonly display: string;
    }
  | { readonly computable: false; readonly display: string };

export const NOT_COMPUTABLE_DISPLAY = "Avancement non calculable — périmètre à clarifier";

/**
 * Progress = accepted weights over applicable weights, per phase then over
 * the whole card. Only an `accepted` criterion counts, and the validator
 * guarantees every accepted criterion carries dated evidence.
 */
export function aggregateProgress(value: unknown): ProgressReport {
  const card = value as CardShape;
  if (card.scope_stability === "unstable") {
    return { computable: false, display: NOT_COMPUTABLE_DISPLAY };
  }
  const phases: PhaseProgress[] = card.phases.map((phase) => {
    const applicable = phase.exit_criteria.reduce((sum, c) => sum + c.weight, 0);
    const accepted = phase.exit_criteria
      .filter((c) => c.status === "accepted")
      .reduce((sum, c) => sum + c.weight, 0);
    return {
      id: phase.id,
      accepted_weight: accepted,
      applicable_weight: applicable,
      ratio: applicable === 0 ? 0 : accepted / applicable,
    };
  });
  const applicableTotal = phases.reduce((sum, p) => sum + p.applicable_weight, 0);
  const acceptedTotal = phases.reduce((sum, p) => sum + p.accepted_weight, 0);
  const overall = applicableTotal === 0 ? 0 : acceptedTotal / applicableTotal;
  return {
    computable: true,
    phases,
    overall_ratio: overall,
    display: `${Math.round(overall * 100)} % du périmètre actuellement déclaré`,
  };
}

export const STATUS_SECTION_BEGIN = "<!-- libre-ai:project-status:begin -->";
export const STATUS_SECTION_END = "<!-- libre-ai:project-status:end -->";

/**
 * The generated status section of a repository README. Deterministic,
 * sentinel-delimited, never hand-edited: the divergence gate fails when the
 * committed section differs from a fresh render of the card.
 */
export function renderStatusSection(value: unknown): string {
  const card = value as CardShape;
  const report = aggregateProgress(card);
  const lines = [
    STATUS_SECTION_BEGIN,
    "<!-- Section générée depuis project.v1.yaml — ne pas éditer à la main. -->",
    "",
    `- Maturité : ${card.maturity}`,
    `- Exposition : ${card.exposure}`,
    `- Confiance : ${card.confidence}`,
    `- Preuves vérifiées le : ${card.freshness.last_verified_on}`,
    `- Avancement : ${report.display}`,
    "",
    STATUS_SECTION_END,
  ];
  return lines.join("\n");
}

/**
 * Divergence gate primitive: the README must contain exactly the freshly
 * rendered section between the sentinels.
 */
export function checkStatusSection(readme: string, card: unknown): string[] {
  const begin = readme.indexOf(STATUS_SECTION_BEGIN);
  const end = readme.indexOf(STATUS_SECTION_END);
  if (begin === -1 || end === -1) {
    return ["README: generated project-status section missing (sentinels not found)"];
  }
  const committed = readme.slice(begin, end + STATUS_SECTION_END.length);
  const fresh = renderStatusSection(card);
  if (committed !== fresh) {
    return ["README: la section statut générée diverge de la fiche project.v1.yaml"];
  }
  return [];
}
