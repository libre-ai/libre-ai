# Biscuit authorization security boundary

## Trust boundary

`libre-ai-authz-biscuit` is the only Rust capability allowed to create or verify
internal Biscuit tokens. Browsers, React applications and pure WIT engines must
never receive a serialized Biscuit.

Trusted inputs are limited to:

- one issuer-held Ed25519 private key;
- a bounded two-key public verification ring;
- canonical policy source embedded at compile time;
- request/resource facts supplied by an already authenticated handler;
- an external revocation store keyed by a verified root block ID.

Token bytes, including `root_key_id`, are untrusted until signature
verification. The key ID may only select a candidate public key. It never grants
authority.

## Fixed verification order

1. Reject an empty or oversized transport value.
2. Read the unverified key ID only to select a currently valid public key.
3. Verify the Ed25519 signature and Biscuit chain.
4. Derive `SHA-256(authority_signature)` as the root block ID.
5. Check external revocation before policy evaluation.
6. Parse the verified authority block and require exactly `user`, `tenant`,
   `role(user, role)` plus one canonical expiry check and no context, rule or
   policy.
7. Require block 1 to be the canonical initial attenuation shape: exact valid
   resource, non-empty bounded operation set, matching tenant and the same
   expiry as authority, with no fact, rule, policy, scope or context. The
   printer and parser use the same pinned Biscuit 5.0 grammar.
8. Reject a remaining lifetime greater than 15 minutes; the sole issuer
   independently enforces activation and original TTL.
9. Inject current time, exact resource/operation, request tenant and
   authoritative resource-tenant/audience/ownership facts.
10. Execute an embedded policy under fact, iteration and time limits. Every
    canonical policy ends in `deny if true`.

Any parse, key, revocation, runtime-limit, query or policy error denies.

## Issuance and attenuation

Issuance accepts only opaque `usr_` and private `ten_` identifiers, one bounded
role, one exact resource, at most 20 operations, an active signing-key time and
a TTL no greater than 900 seconds. The authority source is
`contracts/authz/authority-v1.datalog`.

Every issued token immediately receives an attenuation block binding exact
resource, operation set, tenant and expiry. Verification independently rejects
a root-only token or a malformed/non-canonical first attenuation block. Further attenuation is available
without the issuer key but only when operations form a non-empty subset and all
other bounds remain equal or earlier. The attenuation API has no role field.
Biscuit block trust semantics additionally prevent holder-appended role facts
from satisfying canonical authorizer policies; this has an adversarial test.

## Revocation

The revocation key is derived only after successful signature verification. An
opaque `RevocationTarget`, produced only by issuance or successful
authorization, binds the verified root ID to the root authority expiry. The
checker derives each store record from that target plus a constrained reason
code and current revocation time, so neither callers nor a shorter child
attenuation can purge a root-family revocation while a parent token remains
valid. Records never contain token bytes or identity data. Public checker
methods reject any root ID that is not exactly 64 lowercase hexadecimal bytes
before touching the cache or store.

The status cache is capped at 10,000 entries and 30 seconds. A local revoke
writes the store first, then replaces the cache entry with `revoked`. Missing or
expired cache entries require the store; store failure denies. Clock rollback
invalidates cache freshness. Independent processes may retain a previously
verified non-revoked status for at most the configured cache TTL. A future
storage adapter must also enforce its own bounded connection and operation
timeouts; this synchronous port cannot turn a hung implementation into an
error.

## Key rotation

The ring contains one `Current` key, or one `Current` plus one `Retiring` key.
A second overlapping rotation, non-`Current` steady-state key, reused
in-process key ID/public key, stale/backdated timeline or overlap shorter than
the 900-second maximum TTL is rejected against a caller-supplied trusted current
time. The issuer also refuses signing before its configured activation time.
The sole issuer must switch to the new private key only after the new public key
is active. Operations must add deployment/clock tolerance beyond the enforced
minimum and keep the old public key until every old token has expired; only then
may `finish_rotation` remove it. `revoke_key` is the emergency fail-closed path.
Durable key-ID non-reuse across process/configuration lifetimes belongs to the
future key registry and ceremony.

Private key generation, storage and ceremony are deliberately not implemented
or provisioned here. They remain blocked until G4 secret-storage approval.

## Sensitive-data handling

`SensitiveToken` zeroizes its transport string on drop. Token, bounds, issuer
key material and principal-bearing structures either omit `Debug` or redact
sensitive fields. Errors contain only one canonical refusal code
(`auth.tenant_mismatch`, `auth.biscuit_invalid`, `auth.biscuit_revoked`,
`auth.operation_denied`, or `auth.key_unavailable`) and, after verification,
optionally the root block ID. Operational logs may record root block ID,
policy/rule ID, resource/request ID and outcome; they must not record token
bytes, user IDs, tenant IDs, session IDs or private keys.
