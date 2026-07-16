/**
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiPolicyEvaluationV1 = {
  schemaVersion: "libre-ai.policy-evaluation.v1";
  id: string;
  tenantId: string;
  policyId: string;
  policyDigest: string;
  snapshotId: string;
  snapshotDigest: string;
  needDigest: string;
  engineVersion: string;
  verdict: "eligible" | "ineligible" | "indeterminate";
  ruleResults: Array<{
    ruleId: string;
    status: "satisfied" | "failed" | "unknown";
    reasonCode: string;
  }>;
  evaluatedAt: string;
  digest: string;
};
