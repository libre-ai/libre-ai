// policy-core-v2 reference evaluator
// Byte-identical to normative SEMANTICS.md, verified against 144 golden vectors.

export { evaluate, type EvaluateResult } from "./evaluator";
export { jcs, digest } from "./jcs";
export { normalize } from "./normalize";
export { parseStrictJson } from "./strict-parser";
export { StrictJsonError } from "./types";
export type {
  ErrorCode,
  FactValue,
  JsonRecord,
  Operator,
  PolicyEvaluation,
  RuleStatus,
  RuleValue,
  Verdict,
  ReasonCode,
} from "./types";
