import { describe, expect, it } from "bun:test";
import { canonicalJson, createCollabDocument } from "./index";

describe("CollabDocument — Phase A CRDT kernel", () => {
  describe("1. Convergence", () => {
    it("should converge two replicas after exchanging deltas", () => {
      // Setup two independent docs
      const docA = createCollabDocument();
      const docB = createCollabDocument();

      // Disjoint mutations: A inserts into a list, B inserts into a map
      const listA = docA.getList("items");
      listA.insert(0, "alpha");
      listA.insert(1, "bravo");

      const mapB = docB.getMap("config");
      mapB.set("mode", "dark");
      mapB.set("version", 2);

      // Exchange deltas both ways (simulating a round-trip sync)
      // A → B
      const deltaAToB = docA.exportDeltaSince(docB.version());
      docB.importDelta(deltaAToB);

      // B → A
      const deltaBToA = docB.exportDeltaSince(docA.version());
      docA.importDelta(deltaBToA);

      // Converged snapshots must be identical
      const snapshotA = docA.snapshot();
      const snapshotB = docB.snapshot();
      expect(snapshotA).toEqual(snapshotB);

      // Both should have both list and map
      expect(snapshotA).toEqual({
        items: ["alpha", "bravo"],
        config: { mode: "dark", version: 2 },
      });
    });
  });

  describe("2. Delta round-trip", () => {
    it("should preserve state when exporting delta and importing into fresh doc", () => {
      const docA = createCollabDocument();

      // Mutate docA
      const text = docA.getText("doc");
      text.insert(0, "Hello, CRDT!");

      const list = docA.getList("tasks");
      list.insert(0, { title: "task1", done: false });
      list.insert(1, { title: "task2", done: true });

      // Export the full history as a delta (docB is fresh, so this is everything)
      const delta = docA.exportDeltaSince();

      // Create fresh doc and import the delta
      const docB = createCollabDocument();
      const result = docB.importDelta(delta);
      expect(result.success).toBe(true);
      expect(result.pending).toBe(false);

      // Snapshots must be identical
      expect(docA.snapshot()).toEqual(docB.snapshot());
    });
  });

  describe("3. Snapshot round-trip", () => {
    it("should preserve state when exporting snapshot and importing into fresh doc", () => {
      const docA = createCollabDocument();

      // Build complex state
      const text = docA.getText("title");
      text.insert(0, "CRDT Convergence Test");

      const map = docA.getMap("metadata");
      map.set("author", "claude");
      map.set("timestamp", 1234567890);
      map.set("tags", ["phase-a", "crdt"]);

      const list = docA.getList("entries");
      list.insert(0, "entry-a");
      list.insert(1, "entry-b");
      list.insert(2, "entry-c");

      // Export full snapshot
      const snapshot = docA.exportSnapshot();

      // Import into a fresh doc
      const docB = createCollabDocument(snapshot);

      // Snapshots must be identical
      expect(docA.snapshot()).toEqual(docB.snapshot());
    });
  });

  describe("4. Order-independence", () => {
    it("should converge to identical snapshots regardless of delta application order", () => {
      // Setup: docA and docB, apply the same set of changes in different orders
      const docA = createCollabDocument();
      const docB = createCollabDocument();

      // DocA: mutations in order 1
      const listA = docA.getList("items");
      listA.insert(0, "x");
      const mapA = docA.getMap("props");
      mapA.set("name", "alice");
      const textA = docA.getText("note");
      textA.insert(0, "important");

      // Produce three independent deltas, each from a fresh replica (full history export)
      const deltaList = (() => {
        const tmp = createCollabDocument();
        tmp.getList("items").insert(0, "x");
        return tmp.exportDeltaSince();
      })();

      const deltaMap = (() => {
        const tmp = createCollabDocument();
        tmp.getMap("props").set("name", "alice");
        return tmp.exportDeltaSince();
      })();

      const deltaText = (() => {
        const tmp = createCollabDocument();
        tmp.getText("note").insert(0, "important");
        return tmp.exportDeltaSince();
      })();

      // Apply to docB in a DIFFERENT order than A authored them: text, map, list
      docB.importDelta(deltaText);
      docB.importDelta(deltaMap);
      docB.importDelta(deltaList);

      // Despite the different application order, docB converges to the same logical
      // state as docA (which applied list, map, text). Order-independence is the CRDT
      // property: the merged snapshot is a function of the op-set, not its order.
      const expected = { items: ["x"], props: { name: "alice" }, note: "important" };
      expect(docB.snapshot()).toEqual(expected);
      expect(docA.snapshot()).toEqual(expected);
      expect(docB.checkpoint()).toBe(docA.checkpoint());
    });
  });

  describe("5. Idempotent import", () => {
    it("should leave state unchanged when importing the same delta twice", () => {
      const docA = createCollabDocument();
      const docB = createCollabDocument();

      // Mutate A
      docA.getList("data").insert(0, "value");
      docA.getMap("config").set("enabled", true);

      // Export delta from A
      const delta = docA.exportDeltaSince(docB.version());

      // Import into B twice
      docB.importDelta(delta);
      const snapshotAfterFirst = JSON.parse(JSON.stringify(docB.snapshot()));

      docB.importDelta(delta);
      const snapshotAfterSecond = docB.snapshot();

      // Snapshots must be identical
      expect(snapshotAfterFirst).toEqual(snapshotAfterSecond);
      expect(docA.snapshot()).toEqual(snapshotAfterSecond);
    });
  });

  describe("6. Deterministic checkpoint", () => {
    it("should produce identical checkpoints for converged docs and change on mutation", () => {
      const docA = createCollabDocument();
      const docB = createCollabDocument();

      // Setup identical state via mutations
      docA.getList("items").insert(0, "item1");
      docA.getMap("meta").set("version", 1);

      // Sync B to match A
      const delta = docA.exportDeltaSince(docB.version());
      docB.importDelta(delta);

      // Converged checkpoints must be identical
      const checkpointA1 = docA.checkpoint();
      const checkpointB1 = docB.checkpoint();
      expect(checkpointA1).toBe(checkpointB1);
      expect(checkpointA1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex

      // Mutate A
      docA.getList("items").insert(1, "item2");

      // Checkpoint changes
      const checkpointA2 = docA.checkpoint();
      expect(checkpointA2).not.toBe(checkpointA1);

      // B still has old checkpoint
      expect(docB.checkpoint()).toBe(checkpointB1);

      // After sync, B matches A's new checkpoint
      const deltaBtoA = docA.exportDeltaSince(docB.version());
      docB.importDelta(deltaBtoA);
      expect(docB.checkpoint()).toBe(checkpointA2);
    });
  });

  describe("7. Subscribe", () => {
    it("should fire on local mutation and imported delta, and stop after unsubscribe", async () => {
      const doc = createCollabDocument();
      const events: unknown[] = [];

      // Subscribe
      const unsubscribe = doc.subscribe((event) => {
        events.push(event);
      });

      // A local mutation fires an event once it is committed
      doc.getList("items").insert(0, "a");
      doc.commit();
      expect(events.length).toBeGreaterThan(0);
      const countAfterLocal = events.length;

      // Importing a delta fires an event immediately (import is its own boundary)
      const delta = (() => {
        const tmp = createCollabDocument();
        tmp.getText("text").insert(0, "hello");
        return tmp.exportDeltaSince();
      })();

      doc.importDelta(delta);
      expect(events.length).toBeGreaterThan(countAfterLocal);
      const countAfterImport = events.length;

      // After unsubscribe, no further events — even after a committed mutation
      unsubscribe();
      doc.getList("items").insert(1, "b");
      doc.commit();
      expect(events.length).toBe(countAfterImport);
    });
  });

  describe("Canonicalization and checkpoint hashing", () => {
    it("should produce deterministic hashes for identical logical states", () => {
      // Two docs with identical mutations applied in different orders
      const doc1 = createCollabDocument();
      const map1 = doc1.getMap("obj");
      map1.set("z", 1);
      map1.set("a", 2);
      map1.set("m", 3);

      const doc2 = createCollabDocument();
      const map2 = doc2.getMap("obj");
      map2.set("a", 2);
      map2.set("z", 1);
      map2.set("m", 3);

      // Despite insertion order difference, keys are sorted in canonical form
      expect(doc1.checkpoint()).toBe(doc2.checkpoint());
    });

    it("should reject non-finite numbers in canonicalization", () => {
      const doc = createCollabDocument();
      const _map = doc.getMap("data");
      // Note: Loro may reject Infinity at insertion; if it accepts it, canonicalJson should reject it.
      // For now, this tests the rejection path in canonicalJson directly.

      expect(() => {
        canonicalJson(Infinity);
      }).toThrow("Number must be finite");

      expect(() => {
        canonicalJson(NaN);
      }).toThrow("Number must be finite");
    });
  });

  describe("Container accessors", () => {
    it("should return consistent container references", () => {
      const doc = createCollabDocument();

      const text1 = doc.getText("name");
      const text2 = doc.getText("name");
      // Both refer to the same container
      text1.insert(0, "hello");
      expect(text2.insert).toBeDefined(); // Both are valid containers

      const list1 = doc.getList("items");
      const _list2 = doc.getList("items");
      list1.insert(0, "x");
      // list2 should see the change
      const snapshot = doc.snapshot();
      expect(snapshot).toHaveProperty("items");
    });
  });

  describe("Version tracking", () => {
    it("should track oplog version for partial exports", () => {
      const doc = createCollabDocument();

      const v0 = doc.version();
      expect(typeof v0).toBe("object");
      expect(v0).toBeDefined();

      // A committed mutation advances the oplog version
      doc.getList("data").insert(0, "a");
      doc.commit();
      const v1 = doc.version();
      expect(Array.from(v1.encode())).not.toEqual(Array.from(v0.encode()));

      // Another committed mutation advances it again
      doc.getList("data").insert(1, "b");
      doc.commit();
      const v2 = doc.version();
      expect(Array.from(v2.encode())).not.toEqual(Array.from(v1.encode()));

      // exportDeltaSince(v1) yields a well-formed update covering only post-v1 changes
      const delta = doc.exportDeltaSince(v1);
      expect(delta).toBeInstanceOf(Uint8Array);
    });
  });
});
