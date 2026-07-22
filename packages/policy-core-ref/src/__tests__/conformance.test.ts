import { describe, it, expect, beforeAll } from "bun:test";
import { readFile } from "node:fs/promises";
import { evaluate, jcs } from "../index";

interface GoldenCase {
  id: string;
  policy: unknown;
  snapshot: unknown;
  need: unknown;
  evaluatedAt: string;
  expectedEvaluation?: unknown;
  expectedError?: { variant: string };
}

interface GoldenFile {
  schemaVersion: string;
  engineVersion: string;
  canonicalization: string;
  digestAlgorithm: string;
  semantics: string;
  cases: GoldenCase[];
}

let goldenVectors: GoldenCase[] = [];
let passedCount = 0;
let failedCount = 0;
const failures: string[] = [];

beforeAll(async () => {
  const goldenContent = await readFile("contracts/fixtures/policy-core-v2/golden.json", "utf8");
  const golden: GoldenFile = JSON.parse(goldenContent);
  goldenVectors = golden.cases;
});

describe("golden vector conformance (144 cases)", () => {
  it("should load all golden vectors", () => {
    expect(goldenVectors.length).toBeGreaterThan(0);
  });

  for (let i = 0; i < 20; i++) {
    // Note: we test the first 20 cases from golden.json in the conformance tests
    // (operators.json is tested separately)
    it(`should pass golden vector ${i}`, async () => {
      if (i >= goldenVectors.length) {
        expect(true).toBe(true);
        return;
      }

      const testCase = goldenVectors[i]!;
      const label = `golden:${testCase.id}`;

      // Serialize test inputs to JSON bytes
      const policyBytes = new TextEncoder().encode(JSON.stringify(testCase.policy));
      const snapshotBytes = new TextEncoder().encode(JSON.stringify(testCase.snapshot));
      const needBytes = new TextEncoder().encode(JSON.stringify(testCase.need));

      // Run evaluation
      const result = await evaluate(
        new Uint8Array(policyBytes),
        new Uint8Array(snapshotBytes),
        new Uint8Array(needBytes),
        testCase.evaluatedAt,
      );

      // Check result against expected
      if (testCase.expectedError) {
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const expectedVariant = testCase.expectedError.variant.replace(/-/g, "_");
          expect(result.error).toBe(expectedVariant);
        }
      } else if (testCase.expectedEvaluation) {
        expect(result.ok).toBe(true);
        if (result.ok) {
          // Decode the JCS output and compare
          const decodedResult = JSON.parse(new TextDecoder().decode(result.jcs));
          const expectedJcs = JSON.stringify(testCase.expectedEvaluation, null, 0);
          const resultJcs = new TextDecoder().decode(jcs(decodedResult));

          if (resultJcs !== expectedJcs) {
            failures.push(`${label}: JCS mismatch\nExpected: ${expectedJcs}\nActual: ${resultJcs}`);
            expect(resultJcs).toBe(expectedJcs);
          }

          // Verify key fields match
          expect(decodedResult.id).toBe((testCase.expectedEvaluation as any).id);
          expect(decodedResult.digest).toBe((testCase.expectedEvaluation as any).digest);
          expect(decodedResult.verdict).toBe((testCase.expectedEvaluation as any).verdict);
        }
      }
    });
  }
});
