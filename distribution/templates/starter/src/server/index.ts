import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseServerAddress } from "@libre-ai/web-platform";
import { DevIssuer } from "@libre-ai/auth-web";
import { AuthHttpBoundary } from "@libre-ai/auth-web";
import { InMemoryMembershipDirectory } from "@libre-ai/auth-web";
import { OidcLoginFlow } from "@libre-ai/auth-web";
import { InMemoryOidcTransactionStore } from "@libre-ai/auth-web";
import { SessionService } from "@libre-ai/auth-web";
import { InMemorySessionStore } from "@libre-ai/auth-web";
import { createTemplateHandler } from "./handler";

const { hostname, port } = parseServerAddress(Bun.env);

// Dev-only: self-signed TLS certificate for OIDC requirement (HTTPS-only issuer)
function selfSignedCertificate(): { certPath: string; keyPath: string } {
  const directory = mkdtempSync(join(tmpdir(), "starter-e2e-"));
  const certPath = join(directory, "cert.pem");
  const keyPath = join(directory, "key.pem");
  const generated = Bun.spawnSync([
    "openssl",
    "req",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:P-256",
    "-keyout",
    keyPath,
    "-out",
    certPath,
    "-days",
    "1",
    "-nodes",
    "-subj",
    "/CN=127.0.0.1",
    "-addext",
    `subjectAltName=IP:${hostname}`,
  ]);
  if (generated.exitCode !== 0) {
    throw new Error("e2e.certificate_generation_failed");
  }
  return { certPath, keyPath };
}

const origin = `https://${hostname}:${port}`;

// Dev-only auth boundary setup: deterministic issuer + in-memory stores
const clock = {
  now(): Date {
    return new Date();
  },
};
const issuer = await DevIssuer.create({ clock, issuer: origin });
const directory = new InMemoryMembershipDirectory();
directory.register(await issuer.subjectDigest("dev-user-1"), {
  membershipRevision: 1,
  roles: ["member"],
  tenantId: `ten_${"a".repeat(16)}`,
  userId: `usr_${"b".repeat(16)}`,
});
const sessions = await SessionService.create({
  clock,
  cookieDigestKey: crypto.getRandomValues(new Uint8Array(32)),
  store: new InMemorySessionStore(),
});
const boundary = new AuthHttpBoundary({
  allowedOrigin: origin,
  flow: await OidcLoginFlow.create({
    audience: "libre-ai-web",
    clock,
    directory,
    issuer: origin,
    jwks: () => Promise.resolve(issuer.jwks()),
    store: new InMemoryOidcTransactionStore(),
    tokenEndpoint: (request) => issuer.exchangeCode(request),
    transactionDigestKey: crypto.getRandomValues(new Uint8Array(32)),
  }),
  sessions,
});

// Wrap the template handler with auth boundary and session service
const fetch = createTemplateHandler({ boundary, origin, sessions });

const { certPath, keyPath } = selfSignedCertificate();

const server = Bun.serve({
  fetch: async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    // Dev-issuer endpoint: deterministic authorization for e2e testing
    if (url.pathname === "/authorize" && request.method === "GET") {
      const { code } = issuer.authorize({
        audience: "libre-ai-web",
        codeChallenge: url.searchParams.get("code_challenge") ?? "",
        nonce: url.searchParams.get("nonce") ?? "",
        subject: "dev-user-1",
      });
      const location = new URL("/v1/auth/callback", origin);
      location.searchParams.set("code", code);
      location.searchParams.set("state", url.searchParams.get("state") ?? "");
      return new Response(null, { headers: { Location: location.toString() }, status: 302 });
    }

    // Try to serve static files from dist
    if (
      url.pathname.startsWith("/assets/") ||
      url.pathname === "/manifest.webmanifest" ||
      url.pathname === "/sw.js" ||
      url.pathname === "/static"
    ) {
      const filePath = url.pathname === "/static" ? "/static/index.html" : url.pathname;
      const distFile = Bun.file(join(import.meta.dir, `../../dist${filePath}`));
      if (await distFile.exists()) {
        const contentType = filePath.endsWith(".js")
          ? "text/javascript; charset=utf-8"
          : filePath.endsWith(".css")
            ? "text/css; charset=utf-8"
            : filePath.endsWith(".webmanifest")
              ? "application/manifest+json"
              : filePath.endsWith(".html")
                ? "text/html; charset=utf-8"
                : "application/octet-stream";
        return new Response(distFile, {
          headers: { "Content-Type": contentType },
        });
      }
    }

    // Delegate all other routes to the main handler
    return fetch(request);
  },
  hostname,
  port,
  tls: {
    cert: Bun.file(certPath),
    key: Bun.file(keyPath),
  },
});

console.log(`Libre AI starter listening on ${server.url.origin}`);
