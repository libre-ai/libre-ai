import { expect, test } from "@playwright/test";

const IDEMPOTENCY = `idem_${"e".repeat(16)}`;

async function loginViaApi(page: import("@playwright/test").Page): Promise<void> {
  // Get authorization URL from the login endpoint
  const authorizationUrl = await page.evaluate(async (idempotency) => {
    const response = await fetch("/v1/auth/login", {
      body: JSON.stringify({ returnPath: "/" }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotency,
        "If-Match": '"0"',
      },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`login failed: ${response.status}`);
    }
    const body = (await response.json()) as { authorizationUrl: string };
    return body.authorizationUrl;
  }, IDEMPOTENCY);

  // Navigate to the authorization endpoint (dev-issuer)
  await page.goto(authorizationUrl);

  // The dev-issuer automatically issues a code and redirects to /v1/auth/callback
  // which sets the session cookie and redirects back to /
  await page.waitForURL("**/");

  // Verify session is authenticated
  const sessionState = await page.evaluate(async () => {
    const res = await fetch("/api/session");
    if (!res.ok) {
      throw new Error(`Session check failed: ${res.status}`);
    }
    return (await res.json()) as Record<string, unknown>;
  });

  if (!sessionState.authenticated) {
    throw new Error(`Login failed: not authenticated`);
  }
}

test("full authentication flow: login and logout via API", async ({ page }) => {
  // Navigate to home
  await page.goto("/");

  // Perform login
  await loginViaApi(page);

  // Verify authenticated state
  const sessionState = await page.evaluate(async () => {
    const response = await fetch("/api/session");
    return (await response.json()) as Record<string, unknown>;
  });
  expect(sessionState.authenticated).toBeTruthy();
  expect(sessionState.userId).toBeDefined();
  expect(sessionState.tenantId).toBeDefined();
});

test("add note and verify via API", async ({ page }) => {
  await page.goto("/");
  await loginViaApi(page);

  // Get CSRF token
  const csrfToken = await page.evaluate(async () => {
    const res = await fetch("/e2e/csrf");
    const data = (await res.json()) as { csrfToken: string };
    return data.csrfToken;
  });
  expect(csrfToken.length).toBeGreaterThan(0);

  // Add a note via API
  // Set token on window object for access in evaluate
  await page.evaluate((token: string) => {
    (window as unknown as Record<string, unknown>).__test_csrf_token = token;
  }, csrfToken);

  const noteResponse = await page.evaluate(async () => {
    const token = (window as unknown as Record<string, unknown>).__test_csrf_token as string;
    // ISO 8601 UTC seconds format (YYYY-MM-DDTHH:mm:ssZ) without milliseconds
    const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token,
      },
      body: JSON.stringify({ text: "Test note", createdAt }),
    });
    return { status: res.status, ok: (await res.json()) as Record<string, unknown> };
  });

  // Verify note was added (201 Created)
  expect(noteResponse.status).toBe(201);
  expect(noteResponse.ok.ok).toBeTruthy();

  // Verify the note appears in the list
  const notes = await page.evaluate(async () => {
    const res = await fetch("/api/notes");
    const data = (await res.json()) as { data: unknown[] };
    return data.data;
  });
  expect(notes.length).toBe(1);
});

test("domain refusal: empty note is rejected with 422", async ({ page }) => {
  await page.goto("/");
  await loginViaApi(page);

  // Get CSRF token
  const csrfToken = await page.evaluate(async () => {
    const res = await fetch("/e2e/csrf");
    const data = (await res.json()) as { csrfToken: string };
    return data.csrfToken;
  });

  // Set token on window object for access in evaluate
  await page.evaluate((token: string) => {
    (window as unknown as Record<string, unknown>).__test_csrf_token = token;
  }, csrfToken);

  // Try to add an empty note
  const noteResponse = await page.evaluate(async () => {
    const token = (window as unknown as Record<string, unknown>).__test_csrf_token as string;
    // ISO 8601 UTC seconds format (YYYY-MM-DDTHH:mm:ssZ) without milliseconds
    const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token,
      },
      body: JSON.stringify({ text: "", createdAt }),
    });
    return {
      status: res.status,
      body: (await res.json()) as Record<string, unknown>,
    };
  });

  // Verify rejection (422 Unprocessable Entity with refusal code)
  expect(noteResponse.status).toBe(422);
  expect(noteResponse.body).toHaveProperty("error.code", "starter.note_invalid");
});

test("contracts validation playground via API", async ({ page }) => {
  await page.goto("/");
  await loginViaApi(page);

  // Get available schemas
  const schemas = await page.evaluate(async () => {
    const res = await fetch("/api/schemas");
    const data = (await res.json()) as { data: string[] };
    return data.data;
  });
  expect(schemas.length).toBeGreaterThan(0);

  // Get CSRF token
  const csrfToken = await page.evaluate(async () => {
    const res = await fetch("/e2e/csrf");
    const data = (await res.json()) as { csrfToken: string };
    return data.csrfToken;
  });

  // Validate a document against the first schema
  const schemaName = schemas[0];

  // First set the values on the window object
  await page.evaluate((obj: { schema: string; token: string }) => {
    (window as unknown as Record<string, unknown>).__test_schema = obj.schema;
    (window as unknown as Record<string, unknown>).__test_token = obj.token;
  }, { schema: schemaName, token: csrfToken } as unknown as { schema: string; token: string });

  // Then evaluate the validation
  const validationResponse = await page.evaluate(async () => {
    const schema = (window as unknown as Record<string, unknown>).__test_schema as string;
    const token = (window as unknown as Record<string, unknown>).__test_token as string;
    const res = await fetch("/api/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token,
      },
      body: JSON.stringify({ schemaName: schema, document: {} }),
    });
    return {
      status: res.status,
      body: (await res.json()) as Record<string, unknown>,
    };
  });

  // Verify validation response (200 with ok: true/false)
  expect(validationResponse.status).toBe(200);
  expect(validationResponse.body).toHaveProperty("ok");
});
