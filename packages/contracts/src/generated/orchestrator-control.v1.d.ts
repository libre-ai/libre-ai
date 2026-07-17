/**
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiOrchestratorcontrolV1 = {
  schemaVersion: "libre-ai.orchestrator-control.v1";
  id: string;
  tenantId: string;
  missionId: string;
  runId?: string;
  planDigest: string;
  authorizationDigest: string;
  action: "start" | "pause" | "resume" | "cancel";
  expectedRevision: number;
  idempotencyKey: string;
  reasonCode: string;
  issuedAt: string;
  expiresAt: string;
};
