import { backupExpiryCeiling } from "./backup-ceiling";

/**
 * Completed deletion receipt builder (DATA-LIFECYCLE.md, explicit deletion §5).
 *
 * A `DeletionReceipt` contains opaque digests, stores, timestamps and the
 * backup-expiry ceiling — never deleted content. The builder emits only the
 * contract fields (`libre-ai.deletion-receipt.v1`), sets the accepted `complete`
 * status, and derives the backup expiry from the 35-day ceiling. A deletion
 * that names no subject is refused: an accepted receipt must be attributable.
 */
export const DELETION_RECEIPT_SCHEMA = "libre-ai.deletion-receipt.v1";

export class EmptySubjectSetError extends Error {
  constructor() {
    super("a completed deletion receipt must name at least one subject digest");
    this.name = "EmptySubjectSetError";
  }
}

export interface DeletionStoreOutcome {
  readonly store: string;
  readonly outcome: string;
}

export interface DeletionReceiptInput {
  readonly id: string;
  readonly tenantId: string;
  readonly owner: string;
  readonly subjectDigests: readonly string[];
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly completedAt: string;
  readonly stores: readonly DeletionStoreOutcome[];
}

export interface DeletionReceipt {
  readonly schemaVersion: string;
  readonly id: string;
  readonly tenantId: string;
  readonly owner: string;
  readonly subjectDigests: readonly string[];
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly status: "complete";
  readonly completedAt: string;
  readonly backupExpiresAt: string;
  readonly stores: readonly DeletionStoreOutcome[];
}

export function buildCompletedDeletionReceipt(input: DeletionReceiptInput): DeletionReceipt {
  if (input.subjectDigests.length === 0) {
    throw new EmptySubjectSetError();
  }
  return {
    schemaVersion: DELETION_RECEIPT_SCHEMA,
    id: input.id,
    tenantId: input.tenantId,
    owner: input.owner,
    subjectDigests: [...input.subjectDigests],
    requestedBy: input.requestedBy,
    requestedAt: input.requestedAt,
    status: "complete",
    completedAt: input.completedAt,
    backupExpiresAt: backupExpiryCeiling(input.completedAt),
    stores: [...input.stores],
  };
}
