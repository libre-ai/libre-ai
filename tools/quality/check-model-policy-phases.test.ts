import { describe, expect, test } from "bun:test";

import {
  type ProductPhaseRoadmap,
  replaceReadmeProjection,
  validateRoadmapSemantics,
} from "./check-model-policy-phases";

function validRoadmap(): ProductPhaseRoadmap {
  return {
    schemaVersion: "libre-ai.model-policy-phases.v1",
    authorityStatus: "proposed",
    updatedAt: "2026-07-28T00:00:00Z",
    currentPhase: "MP-P0",
    phases: [
      {
        id: "MP-P0",
        title: "Foundation",
        outcome: "Establish the deterministic authority boundary.",
        document: "docs/apps/model-policy/phases/00-foundation.md",
        status: "in_progress",
        dependsOn: [],
        blockedBy: [],
        gates: [
          {
            id: "MP-P0-G01",
            status: "passed",
            evidence: ["docs/reviews/policy-core-v2/PROMOTION-VERDICT.md"],
          },
          { id: "MP-P0-G02", status: "pending", evidence: [] },
        ],
      },
      {
        id: "MP-P1",
        title: "Deterministic tunnel",
        outcome: "Qualify a use case without an LLM.",
        document: "docs/apps/model-policy/phases/01-deterministic-qualification.md",
        status: "not_started",
        dependsOn: ["MP-P0"],
        blockedBy: [],
        gates: [{ id: "MP-P1-G01", status: "pending", evidence: [] }],
      },
    ],
  };
}

describe("validateRoadmapSemantics", () => {
  test("accepts a gated roadmap whose current phase has started", () => {
    expect(validateRoadmapSemantics(validRoadmap())).toEqual([]);
  });

  test("rejects passed gates without immutable evidence", () => {
    const roadmap = validRoadmap();
    const gate = roadmap.phases[0]?.gates[0];
    if (gate) gate.evidence = [];
    expect(validateRoadmapSemantics(roadmap)).toContain("MP-P0-G01: passed gate has no evidence");
  });

  test("rejects a complete phase with a pending gate", () => {
    const roadmap = validRoadmap();
    const phase = roadmap.phases[0];
    if (phase) phase.status = "complete";
    expect(validateRoadmapSemantics(roadmap)).toContain(
      "MP-P0: complete phase has a non-passed gate",
    );
  });

  test("rejects dependency cycles", () => {
    const roadmap = validRoadmap();
    const first = roadmap.phases[0];
    if (first) first.dependsOn = ["MP-P1"];
    expect(validateRoadmapSemantics(roadmap)).toContain("MP-P0: dependency cycle");
  });

  test("requires a named blocker for a blocked phase", () => {
    const roadmap = validRoadmap();
    const phase = roadmap.phases[0];
    if (phase) phase.status = "blocked";
    expect(validateRoadmapSemantics(roadmap)).toContain(
      "MP-P0: blocked phase has no named blocker",
    );
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

  test("refuses missing markers rather than appending a second authority", () => {
    expect(() => replaceReadmeProjection("# Product\n", "new")).toThrow(
      "README phase projection markers must occur exactly once",
    );
  });
});
