import type { DocumentDescriptor } from "@libre-ai/web-platform";

export function starterDocument(): DocumentDescriptor {
  return {
    app: (
      <main data-testid="journal-root">
        <h1>Libre AI — Starter Template</h1>
        <p>A minimal journal with contracts validation playground.</p>
      </main>
    ),
    description: "Starter template for Libre AI with journal and contracts validation.",
    lang: "en",
    title: "Libre AI — Starter",
  };
}
