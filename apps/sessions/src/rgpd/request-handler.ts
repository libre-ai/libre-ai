// The Sessions data-subject request handler (design §5 step 5), an exported
// factory deliberately NOT mounted on the public cockpit routes: the Sessions
// runtime boundary is locked until WP-G3-S01's sessions-authz-review human
// gate approves real transport integration (see createSessionsHandler's
// fixture-only comment). Wiring it later is one route entry; the whole flow
// is integration-tested here in the meantime.
//
// Order of gates, fail-closed and cheapest-first, before anything touches
// the database: method → body shape → deny-by-default authorization (the
// caller's principal against the locked sessions operation matrix) → subject
// verification. Only then is the request recorded (`received`) and
// dispatched to the port; the terminal state (`fulfilled`/`refused`) is
// appended to the same per-context audit trail. Envelope: { data, meta }.
//
// Two request-id families coexist by design: `request.requestId` anchors the
// API request and its audit rows; an erasure result's `deletionReceiptId` is
// the port-generated deletion-transaction id, cross-referenced by the
// tombstone's receipt_id. The audit `detail` column carries refusal codes
// only — never free text, never PII.

import { type SqlExecutor, withTenantDbTransaction } from "@libre-ai/data";
import {
  type AccessRequestResult,
  computeResponseDeadline,
  DATA_SUBJECT_RIGHT_TYPES,
  type DataSubjectRequest,
  type DataSubjectRightsPort,
  type DataSubjectRightType,
  deriveSubjectDigest,
  type ErasureRequestResult,
  InvalidSubjectIdentifierError,
  type PortabilityRequestResult,
  type RestrictionRequestResult,
  validateDataSubjectRequest,
} from "@libre-ai/rgpd-kit";
import { roleHasOperation, type SessionOperation } from "../authz/session-authorization";
import type { SessionPrincipal } from "../app/execute-command";

export interface DataSubjectRequestDeps {
  readonly port: DataSubjectRightsPort;
  readonly executor: SqlExecutor;
  /** Pre-authenticated caller — authorization here is deny-by-default. */
  readonly principal: SessionPrincipal;
  readonly now: () => string;
  readonly newRequestId: () => string;
}

// Which locked sessions operation a right requires (deny-by-default against
// ROLE_OPERATIONS): reading data out needs `export`, every mutating or
// state-affecting right needs `delete`. Observers hold neither.
const OPERATION_BY_RIGHT: Readonly<Record<DataSubjectRightType, SessionOperation>> = {
  access: "export",
  portability: "export",
  erasure: "delete",
  restriction: "delete",
  rectification: "delete",
  object: "delete",
};

const PRIVATE_TENANT_ID = /^ten_[a-z0-9]{16,64}$/;

type PortResult =
  | AccessRequestResult
  | ErasureRequestResult
  | RestrictionRequestResult
  | PortabilityRequestResult;

interface ParsedBody {
  readonly rightType: DataSubjectRightType;
  readonly subjectIdentifier: string;
  readonly tenantId: string;
}

function envelope(data: unknown, meta: Record<string, unknown>, status: number): Response {
  return Response.json({ data, meta }, { status });
}

function parseBody(raw: unknown): ParsedBody | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const candidate = raw as Record<string, unknown>;
  if (
    typeof candidate.rightType !== "string" ||
    !(DATA_SUBJECT_RIGHT_TYPES as readonly string[]).includes(candidate.rightType)
  ) {
    return null;
  }
  if (typeof candidate.subjectIdentifier !== "string" || candidate.subjectIdentifier === "") {
    return null;
  }
  if (typeof candidate.tenantId !== "string" || !PRIVATE_TENANT_ID.test(candidate.tenantId)) {
    return null;
  }
  return {
    rightType: candidate.rightType as DataSubjectRightType,
    subjectIdentifier: candidate.subjectIdentifier,
    tenantId: candidate.tenantId,
  };
}

export function createDataSubjectRequestHandler(
  deps: DataSubjectRequestDeps,
): (request: Request) => Promise<Response> {
  async function appendAudit(
    request: DataSubjectRequest,
    status: "received" | "fulfilled" | "refused",
    detail: string | null,
  ): Promise<void> {
    await withTenantDbTransaction(deps.executor, request.tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO session_subject_audit
           (tenant_id, request_id, subject_digest, right_type, status, detail, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          request.tenantId,
          request.requestId,
          request.subjectDigest,
          request.rightType,
          status,
          detail,
          deps.now(),
        ],
      );
    });
  }

  async function dispatch(body: ParsedBody, subjectDigest: string): Promise<PortResult> {
    switch (body.rightType) {
      case "access":
        return deps.port.handleAccessRequest(body.tenantId, subjectDigest);
      case "erasure":
        return deps.port.handleErasureRequest(body.tenantId, subjectDigest);
      case "restriction":
        return deps.port.handleRestrictionRequest(body.tenantId, subjectDigest);
      case "portability":
        return deps.port.handlePortabilityRequest(body.tenantId, subjectDigest);
      case "rectification":
      case "object":
        // No port surface yet (design §6): a typed refusal, still audited.
        return {
          status: "refused",
          requestId: deps.newRequestId(),
          refusal: "sessions.rgpd.not_implemented",
        };
    }
  }

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return envelope(null, { refusal: "sessions.rgpd.method_not_allowed" }, 405);
    }
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return envelope(null, { refusal: "sessions.rgpd.request_invalid" }, 400);
    }
    const body = parseBody(rawBody);
    if (body === null) {
      return envelope(null, { refusal: "sessions.rgpd.request_invalid" }, 400);
    }

    // Deny-by-default, before any I/O: the principal must hold the locked
    // sessions operation the right maps to.
    if (!roleHasOperation(deps.principal.role, OPERATION_BY_RIGHT[body.rightType])) {
      return envelope(null, { refusal: "sessions.membership_required" }, 403);
    }

    let subjectDigest: string;
    try {
      subjectDigest = await deriveSubjectDigest(body.tenantId, body.subjectIdentifier);
    } catch (error) {
      if (error instanceof InvalidSubjectIdentifierError) {
        return envelope(null, { refusal: "sessions.rgpd.request_invalid" }, 400);
      }
      throw error;
    }

    const receivedAt = deps.now();
    const base = {
      requestId: deps.newRequestId(),
      subjectDigest,
      rightType: body.rightType,
      tenantId: body.tenantId,
      receivedAt,
      submittedVia: "api",
      deadline: computeResponseDeadline(receivedAt),
    };

    const verified = await deps.port.verifySubject(body.tenantId, body.subjectIdentifier);
    if (verified === null) {
      const refused = validateDataSubjectRequest({
        ...base,
        status: "refused",
        refusalReason: "sessions.rgpd.subject_unverified",
      });
      await appendAudit(refused, "refused", "sessions.rgpd.subject_unverified");
      return envelope({ request: refused }, { refusal: "sessions.rgpd.subject_unverified" }, 404);
    }

    const received = validateDataSubjectRequest({ ...base, status: "received" });
    await appendAudit(received, "received", null);

    const result = await dispatch(body, verified);
    if (result.status === "refused") {
      const refused = validateDataSubjectRequest({
        ...base,
        status: "refused",
        refusalReason: result.refusal,
      });
      await appendAudit(refused, "refused", result.refusal);
      return envelope({ request: refused, result }, { refusal: result.refusal }, 200);
    }
    const fulfilled = validateDataSubjectRequest({ ...base, status: "fulfilled" });
    await appendAudit(fulfilled, "fulfilled", null);
    return envelope({ request: fulfilled, result }, {}, 200);
  };
}
