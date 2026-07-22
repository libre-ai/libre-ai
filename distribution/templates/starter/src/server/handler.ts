import type { AuthHttpBoundary, SessionService } from "@libre-ai/auth-web";
import { SESSION_COOKIE, verifyCsrf } from "@libre-ai/auth-web";
import { loadCanonicalContractRegistry } from "@libre-ai/contracts";
import { renderSsrDocument, secureResponse } from "@libre-ai/web-platform";
import { addNote, createJournal, type Journal, listNotes } from "../domain/journal";
import { starterDocument } from "../shared/document";

interface TemplateHandlerOptions {
  boundary?: AuthHttpBoundary;
  origin?: string;
  sessions?: SessionService;
}

// Per-session state: maps session cookie to user's journal
const sessionJournals = new Map<string, Journal>();

// Lazy-load the contracts registry once at startup
let contractsRegistry: Awaited<ReturnType<typeof loadCanonicalContractRegistry>> | null = null;

async function getContractsRegistry() {
  if (contractsRegistry === null) {
    contractsRegistry = await loadCanonicalContractRegistry();
  }
  return contractsRegistry;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (header === null) {
    return null;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      const value = rest.join("=");
      return value.length === 0 ? null : value;
    }
  }
  return null;
}

function requestId(): string {
  return `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function problemResponse(status: number, code: string, id: string): Response {
  return secureResponse(
    Response.json(
      { error: { code, message: code, requestId: id } },
      { headers: { "Content-Type": "application/problem+json" }, status },
    ),
  );
}

export function createTemplateHandler(
  options?: TemplateHandlerOptions,
): (request: Request) => Promise<Response> {
  const boundary = options?.boundary;
  const origin = options?.origin ?? "http://127.0.0.1:3000";
  const sessions = options?.sessions;

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const id = requestId();

    // Auth-web boundary routes (priority: match before session check)
    if (boundary) {
      if (url.pathname === "/v1/auth/login" && request.method === "POST") {
        return boundary.handleLogin(request);
      }
      if (url.pathname === "/v1/auth/callback" && request.method === "GET") {
        return boundary.handleCallback(request);
      }
      if (url.pathname === "/v1/auth/session" && request.method === "GET") {
        return boundary.handleGetSession(request);
      }
      if (url.pathname === "/v1/auth/session" && request.method === "DELETE") {
        return boundary.handleDeleteSession(request);
      }
    }

    // GET / - SSR document
    if (url.pathname === "/" && request.method === "GET") {
      return renderSsrDocument(starterDocument());
    }

    // GET /api/health
    if (url.pathname === "/api/health" && request.method === "GET") {
      return secureResponse(
        Response.json(
          {
            service: "libre-ai-starter",
            status: "ok",
            version: "v1",
          },
          { status: 200 },
        ),
      );
    }

    // GET /api/session - show authenticated state (no session required)
    if (url.pathname === "/api/session" && request.method === "GET") {
      const sessionCookie = readCookie(request, SESSION_COOKIE);
      if (sessionCookie === null) {
        return secureResponse(Response.json({ authenticated: false }, { status: 200 }));
      }

      if (sessions) {
        const resolved = await sessions.resolveSession(sessionCookie);
        if (!resolved.ok) {
          return secureResponse(Response.json({ authenticated: false }, { status: 200 }));
        }
        return secureResponse(
          Response.json(
            {
              authenticated: true,
              userId: resolved.record.userId,
              tenantId: resolved.record.tenantId,
            },
            { status: 200 },
          ),
        );
      }

      return secureResponse(Response.json({ authenticated: false }, { status: 200 }));
    }

    // E2E CSRF endpoint (development only, requires session)
    if (url.pathname === "/e2e/csrf" && request.method === "GET") {
      const sessionCookie = readCookie(request, SESSION_COOKIE);
      if (sessionCookie === null) {
        return problemResponse(401, "auth.session_missing", id);
      }
      if (sessions) {
        try {
          const { csrfToken } = await sessions.refreshCsrfSecret(sessionCookie);
          return secureResponse(Response.json({ csrfToken }, { status: 200 }));
        } catch {
          return problemResponse(401, "auth.session_invalid", id);
        }
      }
      return problemResponse(401, "auth.session_invalid", id);
    }

    // Helper to require session for protected endpoints
    const requireSession = async (): Promise<string | Response> => {
      const sessionCookie = readCookie(request, SESSION_COOKIE);
      if (sessionCookie === null) {
        return problemResponse(401, "auth.session_missing", id);
      }

      if (sessions) {
        const resolved = await sessions.resolveSession(sessionCookie);
        if (!resolved.ok) {
          return problemResponse(401, "auth.session_invalid", id);
        }
      }

      return sessionCookie;
    };

    // POST /api/notes - add a note to the journal
    if (url.pathname === "/api/notes" && request.method === "POST") {
      const sessionResult = await requireSession();
      if (typeof sessionResult !== "string") {
        return sessionResult;
      }
      const sessionCookie = sessionResult;

      // CSRF check
      if (sessions) {
        const resolved = await sessions.resolveSession(sessionCookie);
        if (resolved.ok) {
          const csrf = await verifyCsrf({
            allowedOrigin: origin,
            csrfSecretDigest: resolved.record.csrfSecretDigest,
            csrfToken: request.headers.get("X-CSRF-Token") ?? "",
            origin: request.headers.get("Origin"),
            secFetchSite: request.headers.get("Sec-Fetch-Site"),
          });
          if (!csrf.ok) {
            return problemResponse(403, "auth.csrf_invalid", id);
          }
        }
      }

      try {
        const body = (await request.json()) as Record<string, unknown>;
        const text = body.text;
        const createdAt = body.createdAt;

        if (typeof text !== "string" || typeof createdAt !== "string") {
          return problemResponse(400, "web.request_body_invalid", id);
        }

        let journal = sessionJournals.get(sessionCookie) ?? createJournal();

        const result = addNote(journal, text, createdAt);
        if (!result.ok) {
          return problemResponse(422, result.refusal, id);
        }

        journal = result.value;
        sessionJournals.set(sessionCookie, journal);

        return secureResponse(Response.json({ ok: true }, { status: 201 }));
      } catch {
        return problemResponse(400, "web.request_body_invalid", id);
      }
    }

    // GET /api/notes - list notes for the session
    if (url.pathname === "/api/notes" && request.method === "GET") {
      const sessionResult = await requireSession();
      if (typeof sessionResult !== "string") {
        return sessionResult;
      }
      const sessionCookie = sessionResult;

      const journal = sessionJournals.get(sessionCookie) ?? createJournal();
      const notes = listNotes(journal);

      return secureResponse(Response.json({ data: notes }, { status: 200 }));
    }

    // GET /api/schemas - list available schema names
    if (url.pathname === "/api/schemas" && request.method === "GET") {
      const sessionResult = await requireSession();
      if (typeof sessionResult !== "string") {
        return sessionResult;
      }

      try {
        const registry = await getContractsRegistry();
        const schemaNames = registry.schemaNames();
        return secureResponse(Response.json({ data: schemaNames }, { status: 200 }));
      } catch {
        return problemResponse(500, "web.internal_error", id);
      }
    }

    // POST /api/validate - validation playground
    if (url.pathname === "/api/validate" && request.method === "POST") {
      const sessionResult = await requireSession();
      if (typeof sessionResult !== "string") {
        return sessionResult;
      }
      const sessionCookie = sessionResult;

      // CSRF check
      if (sessions) {
        const resolved = await sessions.resolveSession(sessionCookie);
        if (resolved.ok) {
          const csrf = await verifyCsrf({
            allowedOrigin: origin,
            csrfSecretDigest: resolved.record.csrfSecretDigest,
            csrfToken: request.headers.get("X-CSRF-Token") ?? "",
            origin: request.headers.get("Origin"),
            secFetchSite: request.headers.get("Sec-Fetch-Site"),
          });
          if (!csrf.ok) {
            return problemResponse(403, "auth.csrf_invalid", id);
          }
        }
      }

      try {
        const body = (await request.json()) as Record<string, unknown>;
        const schemaName = body.schemaName;
        const document = body.document;

        if (typeof schemaName !== "string") {
          return problemResponse(400, "web.request_body_invalid", id);
        }

        const registry = await getContractsRegistry();

        // Try to validate
        try {
          const result = registry.validate(schemaName, document);
          if (result.ok) {
            return secureResponse(Response.json({ ok: true }, { status: 200 }));
          }
          return secureResponse(
            Response.json({ ok: false, issues: result.issues }, { status: 200 }),
          );
        } catch (error) {
          // Schema not found
          if (error instanceof Error && error.message.includes("not found")) {
            return problemResponse(404, "contracts.schema_not_found", id);
          }
          throw error;
        }
      } catch {
        return problemResponse(400, "web.request_body_invalid", id);
      }
    }

    // Not found
    return problemResponse(404, "web.route_not_found", id);
  };
}
