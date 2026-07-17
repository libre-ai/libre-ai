/**
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiSpecializedEngineGoldenVectorIndexV1 = {
  schemaVersion: string;
  world?: string;
  status?: string & string;
  semantics?: string;
  engineVersion?: string;
  digestAlgorithm?: string & string;
  canonicalization?: string & string;
  testMaterialWarning?: string & string;
  contractFiles?: Array<{ path: string; sha256: string }>;
  parseCases?: Array<
    null | boolean | number | string | Array<unknown> | { [key: string]: unknown }
  >;
  evaluationCases?: Array<
    null | boolean | number | string | Array<unknown> | { [key: string]: unknown }
  >;
  cases?: Array<null | boolean | number | string | Array<unknown> | { [key: string]: unknown }>;
  vectors?: Array<null | boolean | number | string | Array<unknown> | { [key: string]: unknown }>;
  aggregationVectors?: Array<
    null | boolean | number | string | Array<unknown> | { [key: string]: unknown }
  >;
  invalidPolicyVectors?: Array<
    null | boolean | number | string | Array<unknown> | { [key: string]: unknown }
  >;
  golden?: null | boolean | number | string | Array<unknown> | { [key: string]: unknown };
  mutations?: Array<null | boolean | number | string | Array<unknown> | { [key: string]: unknown }>;
  standards?: Array<string>;
  reproductionEvidence?:
    | null
    | boolean
    | number
    | string
    | Array<unknown>
    | { [key: string]: unknown };
  contextCanonicalization?:
    | null
    | boolean
    | number
    | string
    | Array<unknown>
    | { [key: string]: unknown };
  recoverySecretCodeProfile?:
    | null
    | boolean
    | number
    | string
    | Array<unknown>
    | { [key: string]: unknown };
};

export type Shortpublicstring = string & string;

export type Publicstring = string;

export type Contractpath = string;

export type Contractfile = { path: string; sha256: string };

export type Vectorlist = Array<
  null | boolean | number | string | Array<unknown> | { [key: string]: unknown }
>;

export type Publicvalue =
  | null
  | boolean
  | number
  | string
  | Array<null | boolean | number | string | Array<unknown> | { [key: string]: unknown }>
  | {
      [key: string]: null | boolean | number | string | Array<unknown> | { [key: string]: unknown };
    };
