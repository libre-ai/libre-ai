/**
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiModelSnapshotV1 = {
  schemaVersion: "libre-ai.model-snapshot.v1";
  id: string;
  tenantId: string;
  modelId: string;
  capturedAt: string;
  facts: Array<{
    name: string;
    value: string | number | boolean | Array<string | number | boolean>;
    source: { uri: string; retrievedAt: string; digest: string; licence: string };
  }>;
  digest: string;
};
