import {
  buildCompletedDeletionReceipt,
  type DeletionReceipt,
  type DeletionStoreOutcome,
} from "../deletion-receipt";
import type { BlobStorePort } from "./blob-store-port";
import { persistDeletionReceipt } from "./deletion-receipt-store";
import type { SqlExecutor } from "./executor";
import type { ProjectionCachePort } from "./projection-cache-port";
import { withTenantDbTransaction } from "./tenant-transaction";

/**
 * Explicit active deletion, end to end (DATA-LIFECYCLE explicit deletion,
 * steps 3-5). Order of operations and its rationale:
 *
 * 1. Cache projections are purged FIRST, with bounded retry. Projections are
 *    disposable and never authoritative, so purging before the SQL command
 *    cannot lose state; a persistent cache failure aborts the whole command
 *    while nothing has been mutated (fail closed, retryable). A cache
 *    failure can never restore access: rows only disappear afterwards.
 * 2. One tenant transaction then deletes the active rows, enqueues only
 *    content-addressed blob deletion, and persists the receipt — atomically.
 *    The receipt's store outcomes reflect what actually happened.
 */
export class CachePurgeFailedError extends Error {
  constructor(attempts: number, cause: unknown) {
    super(
      `projection-cache purge failed after ${attempts} attempts — deletion aborted, retry later`,
      {
        cause,
      },
    );
    this.name = "CachePurgeFailedError";
  }
}

const CACHE_PURGE_ATTEMPTS = 3;

export interface ActiveDeletionRequest {
  readonly id: string;
  readonly tenantId: string;
  readonly owner: string;
  readonly subjectDigests: readonly string[];
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly completedAt: string;
  /** Product-owned: delete the active rows of the subjects inside the tenant transaction. */
  readonly deleteActiveRows: (tx: SqlExecutor) => Promise<void>;
}

export async function executeActiveDeletion(
  executor: SqlExecutor,
  cache: ProjectionCachePort,
  blobs: BlobStorePort,
  request: ActiveDeletionRequest,
): Promise<DeletionReceipt> {
  let lastFailure: unknown;
  let purged = false;
  for (let attempt = 1; attempt <= CACHE_PURGE_ATTEMPTS; attempt += 1) {
    try {
      await cache.purgeTenantProjections(request.tenantId);
      purged = true;
      break;
    } catch (error) {
      lastFailure = error;
    }
  }
  if (!purged) {
    throw new CachePurgeFailedError(CACHE_PURGE_ATTEMPTS, lastFailure);
  }

  return withTenantDbTransaction(executor, request.tenantId, async (tx) => {
    await request.deleteActiveRows(tx);
    const enqueued = await blobs.enqueueContentAddressedDeletion(request.subjectDigests);
    const cellarOutcome: DeletionStoreOutcome =
      enqueued.length > 0
        ? { store: "cellar", outcome: "deleted" }
        : { store: "cellar", outcome: "not-applicable", reasonCode: "deletion.no-blobs" };
    const receipt = buildCompletedDeletionReceipt({
      id: request.id,
      tenantId: request.tenantId,
      owner: request.owner,
      subjectDigests: request.subjectDigests,
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt,
      completedAt: request.completedAt,
      stores: [
        { store: "postgresql", outcome: "deleted" },
        { store: "redis", outcome: "deleted" },
        cellarOutcome,
      ],
    });
    await persistDeletionReceipt(tx, receipt);
    return receipt;
  });
}
