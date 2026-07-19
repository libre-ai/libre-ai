import { describe, expect, test } from "bun:test";

import {
  MissingTenantContextError,
  requireTenantContext,
  runInTenantContext,
} from "./tenant-context";

describe("tenant context deny-by-default", () => {
  test("a query without an established tenant context is denied", () => {
    // DATA-LIFECYCLE.md: "missing tenant context fails transaction".
    expect(() => requireTenantContext()).toThrow(MissingTenantContextError);
  });

  test("an established context exposes exactly its tenant id", async () => {
    const seen = await runInTenantContext("ten_alpha", async () => {
      return requireTenantContext();
    });
    expect(seen).toBe("ten_alpha");
  });

  test("the context is cleared after the scope returns (pool reuse safety)", async () => {
    await runInTenantContext("ten_alpha", async () => {
      return requireTenantContext();
    });
    // DATA-LIFECYCLE.md: "Connection pools clear context before reuse."
    expect(() => requireTenantContext()).toThrow(MissingTenantContextError);
  });

  test("the context is cleared even when the scope throws", async () => {
    await expect(
      runInTenantContext("ten_alpha", async () => {
        throw new Error("scope failure");
      }),
    ).rejects.toThrow("scope failure");
    expect(() => requireTenantContext()).toThrow(MissingTenantContextError);
  });
});
