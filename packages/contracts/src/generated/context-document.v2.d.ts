/**
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiContextDocumentV2 = {
  schemaVersion: "libre-ai.context-document.v2";
  id: string;
  rootBlockIds: Array<string>;
  blocks: Array<{
    id: string;
    revision: number;
    mediaType: "text/plain" | "text/markdown" | "application/json";
    content: string;
    links: Array<string>;
  }>;
  totalBytes: number;
  excludedBlockIds?: Array<string>;
  digest: string;
};
