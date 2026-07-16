import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

type RecordValue = Record<string, unknown>;
const failures: string[] = [];
const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, nested]) => [key, sorted(nested)]),
  );
}
function jcs(value: unknown): string {
  const encoded = JSON.stringify(sorted(value));
  if (encoded === undefined) throw new TypeError("not JSON");
  return encoded;
}
function digest(label: string, value: unknown): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(label);
  hasher.update(new Uint8Array([0]));
  hasher.update(jcs(value));
  return hasher.digest("hex");
}
function without(value: RecordValue, ...keys: string[]): RecordValue {
  const result = structuredClone(value);
  for (const key of keys) delete result[key];
  return result;
}
function compareUtf8(left: unknown, right: unknown): number {
  return Buffer.compare(Buffer.from(String(left), "utf8"), Buffer.from(String(right), "utf8"));
}
function roundRational6(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0)
    throw new RangeError("rational is outside the exact checked range");
  const negative = numerator < 0;
  const scaled = BigInt(Math.abs(numerator)) * 1_000_000n;
  const divisor = BigInt(denominator);
  const quotient = scaled / divisor;
  const remainder = scaled % divisor;
  const doubled = remainder * 2n;
  const rounded =
    doubled > divisor || (doubled === divisor && quotient % 2n === 1n) ? quotient + 1n : quotient;
  const signed = negative ? -rounded : rounded;
  return signed === 0n ? 0 : Number(signed) / 1_000_000;
}
function isUtcSeconds(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]Z$/.test(value)
  )
    return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value.replace("Z", ".000Z");
}
function numberField(value: RecordValue, key: string, label: string): number {
  const candidate = value[key];
  if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate < 0) {
    failures.push(`${label}.${key}: expected non-negative safe integer`);
    return 0;
  }
  return candidate;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
for await (const name of new Bun.Glob("*.schema.json").scan({
  cwd: "contracts/schemas",
  onlyFiles: true,
})) {
  ajv.addSchema(await Bun.file(`contracts/schemas/${name}`).json());
}
const validate = (name: string, value: unknown, label: string): void => {
  const validator = ajv.getSchema(`https://contracts.libre-ai.fr/schemas/${name}`);
  if (!validator?.(value)) failures.push(`${label}: ${name} rejected vector`);
};

const vectorPath = "contracts/fixtures/boussole-scoring-v2/golden-vectors.v1.json";
const vectors = (await Bun.file(vectorPath).json()) as RecordValue;
if (vectors.schemaVersion !== "libre-ai.engine-golden-vectors.v1")
  failures.push("invalid vector version");
const cases = Array.isArray(vectors.cases) ? vectors.cases : [];
const successCases = new Map<string, RecordValue>();
const errorCases = new Map<string, RecordValue>();

for (const [index, rawCase] of cases.entries()) {
  const label = `${vectorPath}#/cases/${index}`;
  if (!isRecord(rawCase) || typeof rawCase.id !== "string") {
    failures.push(`${label}: invalid case`);
    continue;
  }
  if (isRecord(rawCase.expected)) successCases.set(rawCase.id, rawCase);
  else if (typeof rawCase.expectedError === "string") errorCases.set(rawCase.id, rawCase);
  else failures.push(`${label}: case has neither expected output nor closed error`);
}

for (const [id, candidate] of successCases) {
  const label = `${vectorPath}#${id}`;
  const dataset = candidate.dataset;
  const method = candidate.method;
  const responses = candidate.responses;
  const expected = candidate.expected;
  if (!isRecord(dataset) || !isRecord(method) || !isRecord(responses) || !isRecord(expected)) {
    failures.push(`${label}: incomplete success case`);
    continue;
  }
  validate("public-vote-dataset.v2.schema.json", dataset, label);
  validate("boussole-method.v2.schema.json", method, label);
  validate("boussole-response-set.v2.schema.json", responses, label);
  validate("local-comparison.v2.schema.json", expected, label);
  if (Buffer.byteLength(jcs(dataset), "utf8") > 8_388_608)
    failures.push(`${label}: dataset budget`);
  if (Buffer.byteLength(jcs(method), "utf8") > 65_536) failures.push(`${label}: method budget`);
  if (Buffer.byteLength(jcs(responses), "utf8") > 262_144)
    failures.push(`${label}: response budget`);
  if (Buffer.byteLength(jcs(expected), "utf8") > 524_288) failures.push(`${label}: output budget`);

  const methodDigest = digest(
    "libre-ai.boussole-method.v2",
    without(method, "approvedAt", "digest", "approvals"),
  );
  const datasetCore = without(dataset, "publishedAt", "digest", "approvals");
  const statements = Array.isArray(datasetCore.statements)
    ? (datasetCore.statements as RecordValue[])
    : [];
  statements.sort((a, b) => compareUtf8(a.id, b.id));
  const datasetDigest = digest("libre-ai.public-vote-dataset.v2", datasetCore);
  const responseCore = structuredClone(responses);
  const responseValues = Array.isArray(responseCore.responses)
    ? (responseCore.responses as RecordValue[])
    : [];
  responseValues.sort((a, b) => compareUtf8(a.statementId, b.statementId));
  const responseDigest = digest("libre-ai.boussole-response-set.v2", responseCore);
  if (method.digest !== methodDigest || dataset.methodDigest !== methodDigest)
    failures.push(`${label}: method digest mismatch`);
  if (dataset.digest !== datasetDigest || responses.datasetDigest !== datasetDigest)
    failures.push(`${label}: dataset digest mismatch`);
  if (responses.methodDigest !== methodDigest || expected.responseSetDigest !== responseDigest)
    failures.push(`${label}: response digest mismatch`);

  for (const [subject, approvals, subjectDigest] of [
    ["method", method.approvals, methodDigest],
    ["dataset", dataset.approvals, datasetDigest],
  ] as const) {
    if (!Array.isArray(approvals)) {
      failures.push(`${label}: ${subject} approvals missing`);
      continue;
    }
    const records = approvals.filter(isRecord);
    const reviewers = records.map((approval) => approval.reviewerId);
    const roles = records.map((approval) => approval.role).sort();
    if (
      records.length !== 2 ||
      new Set(reviewers).size !== 2 ||
      JSON.stringify(roles) !== JSON.stringify(["legal-privacy-review", "methodological-review"]) ||
      records.some(
        (approval) => approval.actorKind !== "human" || approval.subjectDigest !== subjectDigest,
      )
    )
      failures.push(`${label}: ${subject} approvals are invalid`);
  }

  const scale = Array.isArray(method.responseScale) ? (method.responseScale as number[]) : [];
  const maximum = Math.max(...scale.map((value) => Math.abs(value)));
  if (
    scale.length < 2 ||
    maximum <= 0 ||
    !scale.every(
      (value, index) =>
        Number.isInteger(value) &&
        (index === 0 || value > (scale[index - 1] as number)) &&
        scale.includes(-value),
    )
  )
    failures.push(`${label}: invalid response scale semantics`);

  const originalStatements = Array.isArray(dataset.statements)
    ? (dataset.statements as RecordValue[])
    : [];
  const originalResponses = Array.isArray(responses.responses)
    ? (responses.responses as RecordValue[])
    : [];
  const statementIds = originalStatements.map((statement) => statement.id);
  const responseIds = originalResponses.map((response) => response.statementId);
  if (new Set(statementIds).size !== statementIds.length)
    failures.push(`${label}: duplicate statement id`);
  if (new Set(responseIds).size !== responseIds.length)
    failures.push(`${label}: duplicate response id`);
  if (responseIds.some((statementId) => !statementIds.includes(statementId)))
    failures.push(`${label}: unknown response statement`);

  const responseById = new Map(
    originalResponses.map((response) => [response.statementId, response]),
  );
  let denominator = 0;
  let omitted = 0;
  let weightedNumerator = 0;
  const contributions: RecordValue[] = [];
  for (const statement of [...originalStatements].sort((a, b) => compareUtf8(a.id, b.id))) {
    const votesFor = numberField(statement, "votesFor", label);
    const votesAgainst = numberField(statement, "votesAgainst", label);
    const abstentions = numberField(statement, "abstentions", label);
    const absent = numberField(statement, "absent", label);
    const total = votesFor + votesAgainst + abstentions + absent;
    const response = responseById.get(statement.id);
    if (!response || response.kind === "skip") {
      omitted += total;
      continue;
    }
    const answer = response.value;
    if (typeof answer !== "number" || !scale.includes(answer)) {
      failures.push(`${label}: answer outside response scale`);
      continue;
    }
    const neutral = method.abstentionTreatment === "neutral";
    const considered = votesFor + votesAgainst + (neutral ? abstentions : 0);
    const votesOmitted = absent + (neutral ? 0 : abstentions);
    if (considered === 0) {
      omitted += total;
      continue;
    }
    const difference = votesFor - votesAgainst;
    contributions.push({
      statementId: statement.id,
      contribution: roundRational6(answer * difference, maximum * considered),
      votesConsidered: considered,
      votesOmitted,
    });
    denominator += considered;
    omitted += votesOmitted;
    weightedNumerator += answer * difference;
  }
  const computedAt = candidate.computedAt;
  if (!isUtcSeconds(computedAt)) failures.push(`${label}: invalid computedAt`);
  if (denominator <= 0 || contributions.length === 0) {
    failures.push(`${label}: successful case has zero denominator`);
    continue;
  }
  const computed = {
    schemaVersion: "libre-ai.local-comparison.v2",
    datasetId: dataset.id,
    datasetDigest,
    methodId: method.id,
    methodDigest,
    responseSetDigest: responseDigest,
    score: roundRational6(weightedNumerator, maximum * denominator),
    denominator,
    omitted,
    contributions,
    computedAt,
  };
  if (jcs(expected) !== jcs(computed)) failures.push(`${label}: exact result mismatch`);
  if (jcs(expected).includes("reviewerId")) failures.push(`${label}: reviewer identity in output`);
}

const requiredSuccesses = [
  "excluded-positive",
  "neutral-negative",
  "skip-missing-zero-denominator",
  "weighted-multi-statement",
  "half-even-positive",
  "half-even-negative",
  "maximum-counts-neutral",
];
for (const id of requiredSuccesses)
  if (!successCases.has(id)) failures.push(`missing ${id} vector`);
const positiveTie = successCases.get("half-even-positive")?.expected as RecordValue | undefined;
const negativeTie = successCases.get("half-even-negative")?.expected as RecordValue | undefined;
const maximumCase = successCases.get("maximum-counts-neutral")?.expected as RecordValue | undefined;
if ((positiveTie?.contributions as RecordValue[] | undefined)?.[0]?.contribution !== 0.992188)
  failures.push("positive half-even tie is not covered");
if ((negativeTie?.contributions as RecordValue[] | undefined)?.[0]?.contribution !== -0.992188)
  failures.push("negative half-even tie is not covered");
if (maximumCase?.score !== 0 || Object.is(maximumCase?.score, -0))
  failures.push("negative-zero normalization is not covered");

const expectedErrors = new Map<string, [string | undefined, string | undefined, string]>([
  [
    "reject-duplicate-reviewer",
    [
      "excluded-positive",
      "method.approvals[1].reviewerId = method.approvals[0].reviewerId",
      "approval-invalid",
    ],
  ],
  [
    "reject-zero-denominator",
    ["excluded-positive", "all responses become skip", "denominator-zero"],
  ],
  [
    "reject-digest-mismatch",
    ["excluded-positive", "responses.datasetDigest = 64 zeroes", "digest-mismatch"],
  ],
  [
    "reject-unknown-statement",
    [
      "excluded-positive",
      "responses.responses[0].statementId = unknown_statement",
      "response-invalid",
    ],
  ],
  [
    "reject-unsupported-method",
    ["excluded-positive", "method.formula = future-method", "method-unsupported"],
  ],
  [
    "reject-invalid-computed-at",
    ["excluded-positive", "computedAt = 2026-02-30T00:00:00Z", "computed-at-invalid"],
  ],
  [
    "reject-duplicate-statement",
    ["excluded-positive", "dataset.statements duplicates statement_1", "input-invalid"],
  ],
  ["reject-resource-limit", [undefined, undefined, "resource-limit-exceeded"]],
]);
for (const [id, [fromCase, mutation, code]] of expectedErrors) {
  const errorCase = errorCases.get(id);
  if (!errorCase || errorCase.expectedError !== code) {
    failures.push(`missing ${code} vector`);
    continue;
  }
  if (
    fromCase !== undefined &&
    (errorCase.fromCase !== fromCase || errorCase.mutation !== mutation)
  )
    failures.push(`${id}: mutation binding mismatch`);
  if (fromCase !== undefined && !successCases.has(fromCase))
    failures.push(`${id}: unknown base case`);
}
const resourceLengths = errorCases.get("reject-resource-limit")?.inputByteLengths;
if (
  !isRecord(resourceLengths) ||
  typeof resourceLengths.dataset !== "number" ||
  resourceLengths.dataset <= 8_388_608
)
  failures.push("resource-limit vector does not exceed the dataset byte budget");

const maxVote = 4_294_967_295;
const maxStatements = 1_000;
const maxScale = 5;
const maxTotalConsidered = 3 * maxVote * maxStatements;
const maxTotalOmitted = 4 * maxVote * maxStatements;
const maxWeightedNumerator = maxScale * maxVote * maxStatements;
const maxScoreDenominator = maxScale * maxTotalConsidered;
for (const [label, value] of [
  ["total considered", maxTotalConsidered],
  ["total omitted", maxTotalOmitted],
  ["weighted numerator", maxWeightedNumerator],
  ["score denominator", maxScoreDenominator],
] as const) {
  if (!Number.isSafeInteger(value))
    failures.push(`${label}: schema maximum exceeds exact integer range`);
}

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(
  `Boussole vectors verified: ${successCases.size} success cases, ${errorCases.size} refusal cases, public scoring still candidate-only`,
);
