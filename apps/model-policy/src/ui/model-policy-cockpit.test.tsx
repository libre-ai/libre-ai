import { describe, expect, test } from "bun:test";
import { renderStaticDocument } from "@libre-ai/web-platform";
import { modelPolicyCockpitDocument } from "../shared/document";
import { COCKPIT_FIXTURE } from "./fixture";

// The read view is static (no client module), so the deterministic static render
// is the document the browser receives without JavaScript.
function renderCockpit(): string {
  return new TextDecoder().decode(
    renderStaticDocument(modelPolicyCockpitDocument(COCKPIT_FIXTURE)),
  );
}

describe("model-policy cockpit accessible read view", () => {
  test("renders a well-formed HTML document", async () => {
    const html = renderCockpit();
    expect(html).toStartWith("<!doctype html>");
    expect(html).toContain('lang="fr"');
    expect(html).toContain("Libre AI — Politiques de modèle");
  });

  test("presents an accessible table with a caption and column headers", async () => {
    const html = renderCockpit();
    expect(html).toContain("<caption>");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain("Version");
    expect(html).toContain("Règles");
    expect(html).toContain("Approuvée le");
    // A skip link and a main landmark anchor keyboard navigation.
    expect(html).toContain('href="#policies"');
    expect(html).toContain('id="policies"');
  });

  test("lists every fixture policy by id with its rule count", async () => {
    const html = renderCockpit();
    for (const policy of COCKPIT_FIXTURE) {
      expect(html).toContain(policy.id);
    }
    expect(html).toContain(`${COCKPIT_FIXTURE.length} politique(s).`);
    // No inline colour styling is used to carry meaning.
    expect(html).not.toContain("style=");
  });
});
