import { describe, expect, test } from "bun:test";

import { type DeletionReceiptLike, replayDeletionsOnRestore } from "./restore-replay";

const receipt = (subjectDigests: string[], status = "complete"): DeletionReceiptLike => ({
  subjectDigests,
  status,
});

describe("restore replays accepted deletions", () => {
  test("a restored subject named by a completed receipt does not resurrect", () => {
    const survivors = replayDeletionsOnRestore(["dig_a", "dig_b", "dig_c"], [receipt(["dig_b"])]);
    expect(survivors).toEqual(["dig_a", "dig_c"]);
  });

  test("a restored subject with no receipt survives", () => {
    const survivors = replayDeletionsOnRestore(["dig_a"], []);
    expect(survivors).toEqual(["dig_a"]);
  });

  test("replay is idempotent", () => {
    const once = replayDeletionsOnRestore(["dig_a", "dig_b"], [receipt(["dig_b"])]);
    const twice = replayDeletionsOnRestore(once, [receipt(["dig_b"])]);
    expect(twice).toEqual(["dig_a"]);
  });

  test("an incomplete receipt does not delete on restore", () => {
    // Only accepted (complete) deletions replay; an in-flight receipt must not.
    const survivors = replayDeletionsOnRestore(["dig_a", "dig_b"], [receipt(["dig_b"], "pending")]);
    expect(survivors).toEqual(["dig_a", "dig_b"]);
  });

  test("multiple receipts all replay", () => {
    const survivors = replayDeletionsOnRestore(
      ["dig_a", "dig_b", "dig_c"],
      [receipt(["dig_a"]), receipt(["dig_c"])],
    );
    expect(survivors).toEqual(["dig_b"]);
  });
});
