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
5. Reject any token whose decoded terms would not survive the pinned print/parse
   round trip unchanged (see "Print/parse injectivity" below). This makes the
   reprinted source a faithful rendering of the binary, so the structural checks
   in steps 7–8 can be trusted.
6. Check external revocation before policy evaluation.
7. Parse the verified authority block and require exactly `user`, `tenant`,
   `role(user, role)` plus one canonical expiry check and no context, rule or
   policy.
8. Require block 1 to be the canonical initial attenuation shape: exact valid
   resource, non-empty bounded operation set, matching tenant and the same
   expiry as authority, with no fact, rule, policy, scope or context.
9. Reject a remaining lifetime greater than 15 minutes; the sole issuer
   independently enforces activation and original TTL.
10. Inject current time, exact resource/operation, request tenant and
    authoritative resource-tenant/audience/ownership facts.
11. Execute an embedded policy under fact, iteration and time limits. Every
    canonical policy ends in `deny if true`.

Any parse, key, revocation, runtime-limit, query or policy error denies.

## Print/parse injectivity

Steps 7–8 validate the canonical shape of blocks 0 and 1 by reprinting them with
the biscuit-auth 5.0 printer and reparsing with the version-matched
biscuit-parser 0.1.2. The pinned grammar guarantees the parser understands what
the printer wrote, but it does **not** guarantee that `parse(print(x)) == x`: the
printer emits string values, variable names and predicate names verbatim, with
no escaping, while the parser terminates a string at the first raw `"`, treats
`\` as an escape introducer and stops an identifier at the first non-identifier
byte. A holder of the root key could therefore sign a block whose reprinted
source reparses into a _different, canonical-looking_ structure than the binary
the authorizer actually evaluates — for example an unbounded `operation($x)`
whose variable name reprints as a set-restricted `["read"].contains` check,
silently widening the operation attenuation.

Step 5 removes that entire differential class before the structural checks run.
It walks the decoded terms of every block and rejects the token unless each
`Term::Str` is free of `"` and `\` and every emitted identifier (variable and
predicate name) is a plain datalog identifier. Legitimately issued tokens carry
only charset-restricted identifiers, so they always pass; any injection byte
denies with `auth.biscuit_invalid`. Adversarial tests cover the string and
variable-name channels; a resource carrying `/`, `//`, `:`, `.`, `-` or `_`
round-trips faithfully and is still accepted.

## Issuance and attenuation

Issuance accepts only opaque `usr_` and private `ten_` identifiers, one bounded
role, one exact resource, at most 20 operations, an active signing-key time and
a TTL that is a whole, non-zero number of seconds no greater than 900. Biscuit
encodes expiry at one-second resolution, so a sub-second or fractional TTL is
rejected rather than silently floored into an already-expired or unpredictably
shortened token; the real-clock issue time may still carry nanoseconds and is
floored conservatively, never extending the lifetime. The authority source is
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

The status cache is positive-only and capped at 10,000 entries and 30 seconds:
it caches only `revoked` verdicts. Revocation is monotonic, so a fresh cached
revocation may be served without a store round trip, but a not-revoked verdict
is never cached — every acceptance re-consults the store. This makes an
emergency revocation written by one verifier instance take effect immediately on
every other instance sharing the store; a negative cache would instead let an
instance keep accepting an already-revoked token for up to the cache TTL, a
bounded fail-open window this design forbids. A local revoke writes the store
first, then records the revocation in the cache. Store failure denies. Clock
rollback invalidates cache freshness. A future storage adapter must also enforce
its own bounded connection and operation timeouts; this synchronous port cannot
turn a hung implementation into an error.

## Key rotation

The ring contains one `Current` key, or one `Current` plus one `Retiring` key.
A second overlapping rotation, non-`Current` steady-state key, reused
in-process key ID/public key, stale/backdated timeline or overlap shorter than
the 900-second maximum TTL is rejected against a caller-supplied trusted current
time. The issuer also refuses signing before its configured activation time.
The sole issuer must switch to the new private key only after the new public key
is active. Operations must add deployment/clock tolerance beyond the enforced
minimum and keep the old public key until every old token has expired; only then
may `finish_rotation` remove it. `finish_rotation` computes the surviving keys
and validates that exactly one `Current` key remains _before_ mutating, so a
rejected finish leaves the ring byte-for-byte unchanged instead of silently
emptying it. `revoke_key` is the emergency fail-closed path.
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
