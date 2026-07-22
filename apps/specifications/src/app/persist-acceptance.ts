// Persisted acceptance path — composes the pure decideAcceptance gate with
// persistence. Loads the workspace, runs the pure decideAcceptance, and on
// accept: persists the workspace transition AND stores the content-addressed
// package. Fail-closed: a refused or malformed decision persists nothing.
// Runs inside the caller's tenant transaction (packages/data withTenantDbTransaction).

import type { SqlExecutor } from "@libre-ai/data";
import { saveAcceptedPackage } from "../persistence/spec-package-store";
import { loadWorkspace, saveWorkspace } from "../persistence/spec-workspace-store";
import { type AcceptanceDecision, decideAcceptance } from "./accept-package";

/**
 * Persist an acceptance decision. Load the workspace, run the pure decideAcceptance,
 * and on accept: save the workspace transition and store the content-addressed package.
 * Fail-closed: a refused, malformed, or invalid decision persists nothing.
 *
 * If the workspace revision has been stale (concurrent writer won), a
 * SpecWorkspaceRevisionConflictError is thrown before persistence (the pure
 * decide gates it, but the persisted save may also throw). If the package digest
 * conflicts (workspace already has a different digest), a SpecPackageDigestConflictError
 * is thrown AFTER the workspace is persisted (i.e., on a successful decide, the
 * workspace transaction succeeds but the package transaction fails).
 */
export async function persistAcceptance(
  executor: SqlExecutor,
  workspaceId: string,
  packageInput: unknown,
  expectedRevision: number,
  acceptedBy?: string,
  recordedAt?: string,
): Promise<AcceptanceDecision> {
  const now = recordedAt ?? new Date().toISOString();

  // Load the workspace. If not found, decide with null (invalid state).
  const state = await loadWorkspace(executor, workspaceId);

  // Run the pure decision gate.
  const decision = decideAcceptance(state, packageInput, expectedRevision);

  // Fail-closed: if not accepted, persist nothing.
  if (decision.status !== "accepted") {
    return decision;
  }

  // Persist the workspace transition.
  await saveWorkspace(executor, workspaceId, decision.state, decision.events, now);

  // Persist the content-addressed package. This may throw SpecPackageDigestConflictError
  // if the workspace already has a different digest (a safeguard, though the workspace
  // state machine prevents re-acceptance of an already-accepted workspace).
  const pkg = decision.package;
  await saveAcceptedPackage(executor, pkg, workspaceId, now, acceptedBy);

  return decision;
}
