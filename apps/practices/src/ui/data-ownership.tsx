import { StatusMessage, Surface } from "@libre-ai/ui";
import { useState } from "react";
import type { ExportedActivityOutcome } from "../domain/activity-outcome";

// The export is a LOCAL file operation: a Blob, an object URL and a synthetic
// anchor click. It touches NO network primitive (no fetch / XHR / WebSocket /
// sendBeacon / EventSource / RTCPeerConnection / node net), so the
// `check-no-transmission` guard stays green with no allowlist entry — and this
// helper lives inside `apps/practices` precisely so the guard scans it. It is
// called only from an event handler, never during render, so SSR and hydration
// never touch these browser globals.
function downloadLocalJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

type DeletePhase = "idle" | "confirming" | "deleted";

// Enhanced-only region: a user without JavaScript has no client store to export or
// delete, so the controls are hidden until hydration (`lai-enhanced-only`). Delete
// is destructive, so it goes through an in-page two-step confirmation — never
// `window.confirm`, which blocks the event loop and reads poorly to screen readers.
// Unlike boussole, export has no empty state: an activity outcome always exists.
export function DataOwnership({
  exportData,
  onDeleteAll,
}: {
  readonly exportData: () => ExportedActivityOutcome;
  readonly onDeleteAll: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<DeletePhase>("idle");

  function handleExport(): void {
    downloadLocalJson("practices-activite.json", exportData());
  }

  // The success message claims deletion happened, so it appears only after the
  // store has durably cleared (deleteAll resolves post-persistence).
  async function handleConfirmDelete(): Promise<void> {
    await onDeleteAll();
    setPhase("deleted");
  }

  return (
    <Surface
      as="section"
      aria-labelledby="data-ownership-legend"
      className="lai-enhanced-only lai-stack"
    >
      <h2 id="data-ownership-legend">Mes données</h2>
      <p>
        Votre activité reste sur votre appareil. Vous pouvez l'exporter dans un fichier local ou la
        supprimer à tout moment. Aucune donnée ne quitte l'appareil.
      </p>
      <div className="lai-cluster">
        <button type="button" onClick={handleExport}>
          Télécharger mon activité
        </button>
        {phase === "idle" ? (
          <button type="button" onClick={() => setPhase("confirming")}>
            Supprimer mon activité
          </button>
        ) : null}
      </div>
      {phase === "confirming" ? (
        <div className="lai-stack" data-testid="delete-confirm">
          <StatusMessage politeness="assertive">
            Confirmer la suppression de votre activité locale ? Cette action est définitive.
          </StatusMessage>
          <div className="lai-cluster">
            <button type="button" onClick={handleConfirmDelete}>
              Confirmer la suppression
            </button>
            <button type="button" onClick={() => setPhase("idle")}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}
      {phase === "deleted" ? (
        <StatusMessage data-testid="delete-done">Votre activité a été supprimée.</StatusMessage>
      ) : null}
    </Surface>
  );
}
