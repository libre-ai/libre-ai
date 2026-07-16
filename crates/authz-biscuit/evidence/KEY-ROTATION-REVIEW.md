# WP-G2-Z01 key rotation review

Status: **awaiting independent human approval**
Production authorization: **not granted**

## Implemented state machine

- steady state: exactly one `Current` Ed25519 public key;
- overlap: exactly one `Retiring` old key and one `Current` new key;
- a third key or nested rotation is rejected;
- key IDs are explicit `u32` selectors and unknown IDs deny;
- `valid_from` and `valid_until` are checked before signature verification;
- emergency key revocation removes the selected verification key immediately;
- public metadata exposes only key ID, Ed25519 algorithm, public-key hex,
  validity and status.

## Required ceremony (G4, not performed)

1. Generate a new Ed25519 key in approved EU-resident secret storage; never
   print or export the private value to GitHub or application configuration.
2. Allocate a never-reused key ID and publish the new public metadata.
3. Deploy the two-key verification ring with `valid_from` set before issuer
   switch. Set old `valid_until` later than switch + 900 seconds + accepted
   clock/deployment tolerance.
4. Confirm both old and new test tokens verify, then atomically switch the sole
   issuer to the new private key.
5. Wait until every old token is expired and all instances observe the new key.
6. Call `finish_rotation`; prove old key IDs deny and new issuance still allows.
7. Retain the ceremony receipt, public metadata and aggregate outcome under the
   future security retention policy. Never retain private key material.

Emergency compromise skips the overlap guarantee: remove the compromised key,
revoke known roots where useful, deploy replacement verification metadata and
accept temporary denial rather than fallback verification.

## Automated evidence

`two_key_rotation_has_a_bounded_overlap` proves:

- old and new tokens verify during overlap;
- a third key is rejected;
- early retirement is rejected;
- old key ID fails after retirement;
- the current key still issues and verifies after retirement.

The code does not provision a KMS, secret, environment or Clever Cloud
resource. Those operations remain prohibited before G4.

## Reviewer questions

- Is the overlap formula and deployment tolerance operationally sufficient?
- Must emergency compromise maintain a separate key-ID deny list across a
  configuration rollback?
- Which independent roles may generate, activate, retire and audit keys?
- What G4 secret backend and backup policy satisfy EU residency and separation
  of duties?

Approval must bind this file and the reviewed commit SHA. It does not authorize
production until the Bun stable/toolchain and G4 infrastructure gates are also
accepted.
