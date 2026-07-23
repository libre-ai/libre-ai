import { describe, expect, it } from "bun:test";
import { createCollabDocument } from "./collab-document";
import { SealedCollabDocument } from "./sealed-collab-document";
import { TestIdentityProvider } from "./test-identity-provider";

describe("SealedCollabDocument — Phase B crypto seam", () => {
  describe("1. Transparent sealing and unsealing", () => {
    it("should seal a delta and unseal it to recover plaintext", () => {
      const baseDoc = createCollabDocument();
      const provider = new TestIdentityProvider();
      const sealedDoc = new SealedCollabDocument(baseDoc, provider);

      // Mutate the base doc
      baseDoc.getList("items").insert(0, "alpha");
      baseDoc.getList("items").insert(1, "bravo");

      // Export sealed delta from a fresh version
      const freshVersion = createCollabDocument().version();
      const sealed = sealedDoc.exportSealedDeltaSince(freshVersion);

      // Verify the sealed frame has the expected structure
      expect(sealed).toHaveProperty("epoch");
      expect(sealed).toHaveProperty("nonce");
      expect(sealed).toHaveProperty("ciphertext");
      expect(sealed).toHaveProperty("tag");

      // Unseal to recover the plaintext
      const plaintext = provider.unseal(sealed);
      expect(plaintext).toBeInstanceOf(Uint8Array);
      expect(plaintext.length).toBeGreaterThan(0);
    });
  });

  describe("2. Round-trip through sealed import/export", () => {
    it("should preserve document state through sealed export and import", () => {
      // Setup: two sealed docs
      const baseA = createCollabDocument();
      const baseB = createCollabDocument();
      const providerA = new TestIdentityProvider();
      const providerB = new TestIdentityProvider();

      const sealedA = new SealedCollabDocument(baseA, providerA);
      const sealedB = new SealedCollabDocument(baseB, providerB);

      // Mutate A
      baseA.getList("items").insert(0, "alpha");
      baseA.getMap("meta").set("version", 1);

      // Export sealed delta from A
      const freshVersion = createCollabDocument().version();
      const sealed = sealedA.exportSealedDeltaSince(freshVersion);

      // Import sealed delta into B
      const result = sealedB.importSealedDelta(sealed);
      expect(result.success).toBe(true);
      expect(result.pending).toBe(false);

      // Snapshots must match
      expect(sealedA.snapshot()).toEqual(sealedB.snapshot());
    });
  });

  describe("3. Epoch-based frame validation", () => {
    it("should reject frames with mismatched epoch", () => {
      const baseDoc = createCollabDocument();
      const provider = new TestIdentityProvider();
      const sealedDoc = new SealedCollabDocument(baseDoc, provider);

      // Create a frame and manually alter its epoch to simulate epoch mismatch
      baseDoc.getList("items").insert(0, "data");
      const sealed = sealedDoc.exportSealedDeltaSince();
      const mismatchedFrame = {
        ...sealed,
        epoch: sealed.epoch + 999, // Intentional mismatch
      };

      // Unseal should fail (epoch mismatch is fail-closed)
      expect(() => {
        provider.unseal(mismatchedFrame);
      }).toThrow("Epoch mismatch");
    });
  });

  describe("4. Sealed document delegation", () => {
    it("should delegate all Phase A operations to the base document", () => {
      const baseDoc = createCollabDocument();
      const provider = new TestIdentityProvider();
      const sealedDoc = new SealedCollabDocument(baseDoc, provider);

      // Test getText delegation
      const text = sealedDoc.getText("title");
      text.insert(0, "Hello");

      // Test getMap delegation
      const map = sealedDoc.getMap("meta");
      map.set("author", "test");

      // Test getList delegation
      const list = sealedDoc.getList("items");
      list.insert(0, "item1");

      // Commit and verify snapshot
      sealedDoc.commit();
      const snapshot = sealedDoc.snapshot();
      expect(snapshot).toEqual({
        title: "Hello",
        meta: { author: "test" },
        items: ["item1"],
      });

      // Verify checkpoint is identical to base doc
      expect(sealedDoc.checkpoint()).toBe(baseDoc.checkpoint());
    });
  });

  describe("5. Unsealing failures are fail-closed", () => {
    it("should not modify the document if unseal throws", () => {
      const baseDoc = createCollabDocument();
      const provider = new TestIdentityProvider();
      const sealedDoc = new SealedCollabDocument(baseDoc, provider);

      // Setup: document with initial state
      baseDoc.getList("items").insert(0, "initial");
      const initialSnapshot = sealedDoc.snapshot();

      // Create a frame with wrong epoch
      const badFrame = {
        epoch: 999,
        nonce: new Uint8Array(12),
        ciphertext: new Uint8Array([1, 2, 3]),
        tag: new Uint8Array(16),
      };

      // Attempt to import: should throw before modifying the doc
      expect(() => {
        sealedDoc.importSealedDelta(badFrame);
      }).toThrow();

      // Document state must be unchanged
      expect(sealedDoc.snapshot()).toEqual(initialSnapshot);
    });
  });

  describe("6. Plain (unsealed) delta import", () => {
    it("should import plaintext deltas via importDelta()", () => {
      const baseA = createCollabDocument();
      const baseB = createCollabDocument();
      const provider = new TestIdentityProvider();
      const sealedA = new SealedCollabDocument(baseA, provider);
      const sealedB = new SealedCollabDocument(baseB, provider);

      // Mutate A
      baseA.getList("data").insert(0, "value");

      // Export plaintext from A
      const plainDelta = baseA.exportDeltaSince(baseB.version());

      // Import plaintext into B (via the sealed wrapper's passthrough)
      const result = sealedB.importDelta(plainDelta);
      expect(result.success).toBe(true);

      // State should match
      expect(sealedA.snapshot()).toEqual(sealedB.snapshot());
    });
  });

  describe("7. Current epoch reporting", () => {
    it("should report the current epoch from the provider", () => {
      const baseDoc = createCollabDocument();
      const provider = new TestIdentityProvider();
      const sealedDoc = new SealedCollabDocument(baseDoc, provider);

      const epoch = sealedDoc.currentEpoch();
      expect(epoch).toBe(0); // TestIdentityProvider uses epoch 0
      expect(epoch).toBe(provider.currentEpoch());
    });
  });

  describe("8. Subscription delegation", () => {
    it("should fire subscribers when base doc changes", async () => {
      const baseDoc = createCollabDocument();
      const provider = new TestIdentityProvider();
      const sealedDoc = new SealedCollabDocument(baseDoc, provider);

      const events: unknown[] = [];
      const unsubscribe = sealedDoc.subscribe((event) => {
        events.push(event);
      });

      // Mutate through sealed doc
      sealedDoc.getList("items").insert(0, "a");
      sealedDoc.commit();
      expect(events.length).toBeGreaterThan(0);

      const countAfterMutation = events.length;

      // Import a delta (also triggers subscribers via base doc)
      const otherDoc = createCollabDocument();
      otherDoc.getText("text").insert(0, "hello");
      const delta = otherDoc.exportDeltaSince(sealedDoc.version());
      sealedDoc.importDelta(delta);
      expect(events.length).toBeGreaterThan(countAfterMutation);

      unsubscribe();
    });
  });
});
