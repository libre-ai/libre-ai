import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Transaction-local tenant context (DATA-LIFECYCLE.md, tenant boundary).
 *
 * RLS is set only after browser-session or Biscuit authorization establishes a
 * tenant scope. Outside such a scope every access is denied — "missing tenant
 * context fails transaction". The scope clears automatically on return or throw,
 * satisfying "connection pools clear context before reuse".
 */
export class MissingTenantContextError extends Error {
  constructor() {
    super("no tenant context is established");
    this.name = "MissingTenantContextError";
  }
}

const storage = new AsyncLocalStorage<string>();

export function runInTenantContext<T>(
  tenantId: string,
  scope: () => Promise<T>,
): Promise<T> {
  return storage.run(tenantId, scope);
}

export function requireTenantContext(): string {
  const tenantId = storage.getStore();
  if (tenantId === undefined) {
    throw new MissingTenantContextError();
  }
  return tenantId;
}
