/**
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiProblemDetailsV1 = {
  error: {
    code: string;
    message: string;
    requestId: string;
    fields?: Array<{ path: string; code: string }>;
  };
};
