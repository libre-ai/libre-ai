import { describe, expect, test } from "bun:test";

describe("canonical bootstrap", () => {
  test("uses the qualified Bun package manager with a 1.4 floor", async () => {
    const manifest = (await Bun.file("package.json").json()) as {
      packageManager?: string;
      engines?: { bun?: string };
    };
    const toolchain = (await Bun.file("toolchains/bun.json").json()) as {
      minimumVersion?: string;
    };
    expect(manifest.packageManager).toBe("bun@1.4.0-canary.1");
    expect(manifest.engines?.bun).toBe(">=1.4.0");
    expect(toolchain.minimumVersion).toBe("1.4.0");
  });

  // γ 3.7: the Knowledge Object schema left with ecosystem/schemas — its
  // canonical home is governance; the archive keeps no local copy to assert.
});
