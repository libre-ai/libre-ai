import { describe, expect, test } from "bun:test";
import { MissingTenantContextError, runInTenantContext } from "./tenant-context";
import {
  CrossTenantAccessError,
  guardTenantRow,
  PublicTenantRejectedError,
} from "./tenant-row-guard";

describe("tenant row guard (cross-tenant deny)", () => {
  test("a row owned by the current tenant is returned unchanged", async () => {
    const row = { tenant_id: "ten_alpha", id: "rec_1" };
    const guarded = await runInTenantContext("ten_alpha", async () => guardTenantRow(row));
    expect(guarded).toBe(row);
  });

  test("a row owned by another tenant is denied", async () => {
    await runInTenantContext("ten_alpha", async () => {
      expect(() => guardTenantRow({ tenant_id: "ten_beta", id: "rec_2" })).toThrow(
        CrossTenantAccessError,
      );
    });
  });

  test("guarding a row without any tenant context is denied", () => {
    expect(() => guardTenantRow({ tenant_id: "ten_alpha", id: "rec_3" })).toThrow(
      MissingTenantContextError,
    );
  });

  test("the public service tenant is rejected on private rows", async () => {
    // DATA-LIFECYCLE.md: "public is not a private tenant";
    // "product-private schemas reject it".
    await runInTenantContext("public", async () => {
      expect(() => guardTenantRow({ tenant_id: "public", id: "rec_4" })).toThrow(
        PublicTenantRejectedError,
      );
    });
  });

  test("a row with a missing tenant_id is denied", async () => {
    await runInTenantContext("ten_alpha", async () => {
      expect(() => guardTenantRow({ tenant_id: "", id: "rec_5" })).toThrow(CrossTenantAccessError);
    });
  });
});
