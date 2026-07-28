import { describe, expect, test } from "bun:test";
import { extractAnchors, findDanglingAnchors, parseFrozenRevisions } from "./check-commit-anchors";

describe("anchor extraction", () => {
  test("reads backticked short SHAs", () => {
    expect(extractAnchors("merged as `521d1b8`, frozen at `c8fb246`")).toEqual([
      "521d1b8",
      "c8fb246",
    ]);
  });

  test("ignores all-digit runs, which are numbers and not anchors", () => {
    expect(extractAnchors("budget `1000000` and mask `8000000`")).toEqual([]);
  });

  // Documented cost of the rule above: an all-digit SHA such as STATUS.md's
  // `6218654` is skipped rather than checked. The guard trades a false negative
  // for never failing a document over a number that merely looks hexadecimal.
  test("an all-digit SHA is skipped, not flagged", () => {
    expect(extractAnchors("accepted on `6218654`")).toEqual([]);
  });

  test("ignores SHAs that are not backticked", () => {
    expect(extractAnchors("see commit 6218654 for context")).toEqual([]);
  });

  test("deduplicates repeated anchors", () => {
    expect(extractAnchors("`c8fb246` then `c8fb246`")).toEqual(["c8fb246"]);
  });

  test("ignores runs outside the 7-10 character window", () => {
    expect(extractAnchors("`abcdef` and `abcdef1234567890abcd`")).toEqual([]);
  });
});

describe("frozen revisions", () => {
  test("collects declared revisions from the legacy manifest", () => {
    const frozen = parseFrozenRevisions(`
  - id: legacy.website
    remote: https://example.invalid/website.git
    revision: 0318c92b5b0f4fed82cc64b75e5132db04ea04e3
  - id: legacy.design-system
    revision: c8fb246c213b2ac962491c316ce807322d692a6e
`);
    expect(frozen.size).toBe(2);
    expect(frozen.has("0318c92b5b0f4fed82cc64b75e5132db04ea04e3")).toBe(true);
  });
});

describe("dangling detection", () => {
  const frozen = new Set(["0318c92b5b0f4fed82cc64b75e5132db04ea04e3"]);

  test("flags an anchor that neither resolves nor is declared frozen", () => {
    const dangling = findDanglingAnchors(
      [{ path: "STATUS.md", text: "accepted on `deadbee`" }],
      () => false,
      frozen,
    );
    expect(dangling).toEqual([{ file: "STATUS.md", sha: "deadbee" }]);
  });

  test("accepts an anchor that resolves in this history", () => {
    expect(
      findDanglingAnchors([{ path: "STATUS.md", text: "`deadbee`" }], () => true, frozen),
    ).toHaveLength(0);
  });

  test("accepts a short prefix of a declared frozen revision", () => {
    expect(
      findDanglingAnchors(
        [{ path: "STATUS.md", text: "frozen at `0318c92`" }],
        () => false,
        frozen,
      ),
    ).toHaveLength(0);
  });

  test("a prefix of no declared revision is still dangling", () => {
    expect(
      findDanglingAnchors([{ path: "STATUS.md", text: "`0318c93`" }], () => false, frozen),
    ).toHaveLength(1);
  });
});
