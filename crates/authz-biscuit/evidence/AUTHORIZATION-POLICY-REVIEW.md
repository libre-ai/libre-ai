# WP-G2-Z01 authorization policy review

Status: **fresh independent agent review required after adversarial remediation**
Production authorization: **not granted**

## Authorities reviewed by the implementation

| Authority | SHA-256 |
| --- | --- |
| `contracts/authz/authority-v1.datalog` | `eb88b62cd252414bf80089f9be7478475310b3b25d88da528d389a4971e310ea` |
| `contracts/authz/sessions-v1.datalog` | `93bc93e9a4c7b17716787bc9b56df592652b1df0f02d581765cc61010ecaefe1` |
| `contracts/authz/missions-v1.datalog` | `9bfa33eda5e34b8a8d1262881fc951e2455c47769ccaf48d0359bed14a20d2be` |

The contract files are read-only in `Z01`; policy sources are embedded directly
from them. The verifier independently checks the signed authority shape, the
mandatory canonical first attenuation block and the 15-minute maximum remaining
lifetime before executing an authorizer.

## Evidence vectors

| Vector | Expected result |
| --- | --- |
| requester + same tenant + mission read | allow |
| unknown operation | deny |
| missing authority tenant | deny |
| missing authority expiry check | deny |
| canonical signed authority without initial attenuation | deny |
| malformed/non-canonical initial attenuation | deny |
| cross-tenant resource or divergent resource-tenant witness | deny |
| role not recognized by mission policy | deny |
| participant private read without matching ownership | deny |
| participant private read with authoritative ownership | allow |
| expired authority | deny |
| operation added after attenuation | deny |
| resource, tenant or expiry expansion | rejected before serialization |
| holder-appended approver role | deny |
| unknown key ID | deny before policy |
| revoked verified root block | deny before policy |
| unavailable revocation store without fresh cache | deny before policy |
| cache TTL expiry or clock rollback with unavailable store | deny before policy |
| malformed or oversized revocation root ID | reject before store access |
| shorter child attenuation targets the same root family | retain revocation to authority expiry |
| token/principal debug formatting | redacted |

Tests: `crates/authz-biscuit/tests/authz.rs`.

## Reviewer questions

- Do all current Sessions and Missions allow rules represent the locked product
  authority, including `private` contribution ownership?
- Is exact resource binding sufficient for all G3 workers, or must a future
  contract add explicit job/source/budget predicates before those workers ship?
- Is the maximum 30-second previously verified revocation cache window accepted
  for every operation, or must selected operations force a store read?
- Are the five locked refusal codes sufficiently generic while retaining useful
  root/policy evidence?

The dedicated review-only pass must follow `docs/reviews/AGENT-REVIEW-PROTOCOL.md`,
identify its pass/provider/model metadata and bind this file, the three
authority hashes and the reviewed commit SHA.
