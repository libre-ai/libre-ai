//! Harness attestation core — the pure half of WP-G3-H01.
//!
//! An attestation is what separates *the harness confined this run* from *the
//! harness says it confined this run*. This crate builds the canonical document
//! the contract defines, digests it, and refuses anything weaker than it would
//! read as. It holds no OS capability: filesystem enforcement and process
//! spawning are later increments with their own reviews (ADR-0018 D2).
//!
//! **Formats come from the contract wherever the contract can generate them.**
//! Every patterned field validates through the newtypes
//! `libre-ai-contract-types` derives from the JSON Schema, whose regexes are the
//! schema's own; an earlier version hand-wrote those checks and reviews proved
//! them divergent in both directions. Three things typify does not project, and
//! which are therefore transcribed here under [`check_binding`]: the collection
//! bounds, the `const` on `schemaVersion` — stamped rather than accepted — and
//! `format: date-time`, which has no newtype at all. That last one is the field
//! every round of review has found a defect in; [`is_canonical_timestamp`]
//! states exactly what it accepts and why.
//!
//! **The digest is computed over the contract document.** camelCase names,
//! `schemaVersion` stamped, everything except the two fields the contract
//! excludes — `attestationDigest` and `signature`. That is what makes the golden
//! vector in `contracts/fixtures/agent-orchestration-v1/digest-vectors.v1.json`
//! reproducible here, and therefore what lets an operator holding only
//! `contracts/` re-verify an attestation with no harness-specific rule.
//!
//! Three properties carry the rest, each locked by an adversarial test:
//!
//! 1. **Requested and effective stay distinct, and both are bound.** A degraded
//!    sandbox must remain visible, so a divergence is recorded rather than
//!    refused — refusing it would push the caller to report the requested
//!    profile and lose the truth. Both live inside the digested document.
//! 2. **Verification is not forgeable by shape.** [`VerifiedAttestation`] and
//!    [`HarnessAttestation`] carry a private witness, so neither can be built
//!    outside this module, and functional-update syntax cannot inherit it.
//! 3. **A closed capability is refused on both gates that grant.** Assembly and
//!    verification refuse what ADR-0018 D2 keeps shut. [`attestation_digest`]
//!    deliberately does not: hashing is arithmetic, and a verifier must be able
//!    to digest a document it will then refuse — which is also why the golden
//!    vector, carrying a closed capability, stays reproducible.
//!
//! **What this increment does not yet carry**, named rather than left silent:
//! of the fifteen refusals in the specification's matrix, four are implemented
//! here and one is defensive. `profile_unresolved`, `profile_digest_mismatch`
//! and `platform_unsupported` belong to this same increment and await the
//! digest-to-profile resolver; `control_not_enforceable`,
//! `path_escapes_workspace`, `symlink_policy_violation`,
//! `write_outside_writable_set` and `denied_path_touched` await filesystem
//! confinement; `output_limit_exceeded` and `output_scan_incomplete` await
//! bounded process execution. The capability gate also covers `networkMode`
//! only — a caller can still name `network_egress` in `effectiveControls`,
//! because no locked vocabulary exists to check that field against.
//!
//! What it does not establish: that the signature is cryptographically valid.
//! Signing is a deferred owner ceremony, so this crate takes an
//! [`AttestationSigner`], refuses to emit anything it cannot get signed, and
//! leaves digest-to-signature verification to the ceremony increment.

#![forbid(unsafe_code)]

use std::str::FromStr;

use libre_ai_contract_types::generated::harness_attestation_v1 as contract;
use serde::Serialize;
use sha2::{Digest, Sha256};

/// Locked by `contracts/schemas/harness-attestation.v1.schema.json`.
pub const SCHEMA_VERSION: &str = "libre-ai.harness-attestation.v1";

const MAX_COLLECTION_ITEMS: usize = 128;

/// Re-exported from the generated contract types rather than redefined: their
/// serialized spellings are the schema's, so `linux-x86_64` cannot drift.
pub use contract::LibreAiHarnessAttestationV1NetworkMode as NetworkMode;
pub use contract::LibreAiHarnessAttestationV1Platform as Platform;

/// Refusals of the attestation core. Each names the failing invariant and never
/// echoes the offending value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HarnessRefusal {
    /// A binding the attestation claims to carry is absent or malformed.
    AttestationBindingIncomplete,
    /// A capability closed by ADR-0018 D2 was requested.
    CapabilityNotEnabled,
    /// No signature of the expected shape is present.
    AttestationUnsigned,
    /// The recorded digest does not match the bound fields.
    AttestationDigestMismatch,
    /// Canonical serialization failed; nothing is hashed on a partial document.
    /// Defensive: unreachable for the current document shape, kept so a future
    /// field type that JCS can reject fails closed instead of panicking.
    CanonicalizationFailed,
}

impl HarnessRefusal {
    /// Stable code, matching the namespacing of the socle's other engines.
    #[must_use]
    pub fn code(self) -> &'static str {
        match self {
            Self::AttestationBindingIncomplete => "harness.attestation_binding_incomplete",
            Self::CapabilityNotEnabled => "harness.capability_not_enabled",
            Self::AttestationUnsigned => "harness.attestation_unsigned",
            Self::AttestationDigestMismatch => "harness.attestation_digest_mismatch",
            Self::CanonicalizationFailed => "harness.canonicalization_failed",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactReference {
    pub id: String,
    pub digest: String,
    pub media_type: String,
}

/// Everything an attestation binds, as the caller supplies it.
///
/// Strings rather than the generated newtypes, so a caller is not forced to
/// thread contract types through its own code; every one of them is validated
/// against the generated type before anything is hashed.
///
/// `schemaVersion` is deliberately absent: it is stamped from [`SCHEMA_VERSION`]
/// when the canonical document is built, so a caller cannot claim a version it
/// does not implement.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttestationInput {
    pub id: String,
    pub tenant_id: String,
    pub mission_id: String,
    pub run_id: String,
    pub plan_digest: String,
    pub requested_profile_digest: String,
    pub effective_profile_digest: String,
    pub worker_manifest_digests: Vec<String>,
    pub sandbox_engine_manifest: ArtifactReference,
    pub platform: Platform,
    pub effective_controls: Vec<String>,
    pub network_mode: NetworkMode,
    pub generated_at: String,
    pub signing_key_id: String,
}

/// The document the contract defines, minus the two fields it excludes from the
/// digest. Field order is irrelevant — JCS sorts keys — but names and casing are
/// the contract's.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CanonicalDocument<'a> {
    schema_version: &'static str,
    id: &'a str,
    tenant_id: &'a str,
    mission_id: &'a str,
    run_id: &'a str,
    plan_digest: &'a str,
    requested_profile_digest: &'a str,
    effective_profile_digest: &'a str,
    worker_manifest_digests: &'a [String],
    sandbox_engine_manifest: &'a ArtifactReference,
    platform: &'a Platform,
    effective_controls: &'a [String],
    network_mode: &'a NetworkMode,
    generated_at: &'a str,
    signing_key_id: &'a str,
}

impl<'a> From<&'a AttestationInput> for CanonicalDocument<'a> {
    fn from(input: &'a AttestationInput) -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            id: &input.id,
            tenant_id: &input.tenant_id,
            mission_id: &input.mission_id,
            run_id: &input.run_id,
            plan_digest: &input.plan_digest,
            requested_profile_digest: &input.requested_profile_digest,
            effective_profile_digest: &input.effective_profile_digest,
            worker_manifest_digests: &input.worker_manifest_digests,
            sandbox_engine_manifest: &input.sandbox_engine_manifest,
            platform: &input.platform,
            effective_controls: &input.effective_controls,
            network_mode: &input.network_mode,
            generated_at: &input.generated_at,
            signing_key_id: &input.signing_key_id,
        }
    }
}

/// Private witness. Its only purpose is to stop a downstream crate from writing
/// a struct literal — or a functional update of a legitimate value — and calling
/// it a verified result.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Sealed;

/// Produces the signature over an attestation digest.
///
/// The production key is an owner ceremony, deferred and separate; this crate
/// holds no key material and refuses to emit anything a signer will not sign.
pub trait AttestationSigner {
    /// Signature of `digest`, or `None` when the key is unavailable.
    fn sign(&self, digest: &str) -> Option<String>;
    /// Identifier the signer declares. Bound into the document, and required to
    /// match the one the caller named — note that this ties the document to a
    /// *declared* identity, not to the key that produced the bytes. Verifying
    /// digest against signature belongs to the ceremony increment.
    fn key_id(&self) -> &str;
}

/// An assembled, signed attestation. Cannot be built outside this module.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HarnessAttestation {
    input: AttestationInput,
    attestation_digest: String,
    signature: String,
    sealed: Sealed,
}

impl HarnessAttestation {
    #[must_use]
    pub fn input(&self) -> &AttestationInput {
        &self.input
    }

    #[must_use]
    pub fn attestation_digest(&self) -> &str {
        &self.attestation_digest
    }

    #[must_use]
    pub fn signature(&self) -> &str {
        &self.signature
    }

    /// Whether the applied confinement differs from the one requested. Both
    /// values are inside the digested document, so this cannot be made to lie
    /// without breaking the digest.
    #[must_use]
    pub fn diverged(&self) -> bool {
        self.input.requested_profile_digest != self.input.effective_profile_digest
    }

    /// The contract document, ready to serialize and hand to a consumer.
    ///
    /// Without this a consumer would recompose the JSON by hand, re-deriving
    /// camelCase and the enum spellings — the very private projection that made
    /// the first version of this crate unverifiable.
    pub fn to_contract_document(
        &self,
    ) -> Result<contract::LibreAiHarnessAttestationV1, HarnessRefusal> {
        let document = serde_json::json!({
            "schemaVersion": SCHEMA_VERSION,
            "id": self.input.id,
            "tenantId": self.input.tenant_id,
            "missionId": self.input.mission_id,
            "runId": self.input.run_id,
            "planDigest": self.input.plan_digest,
            "requestedProfileDigest": self.input.requested_profile_digest,
            "effectiveProfileDigest": self.input.effective_profile_digest,
            "workerManifestDigests": self.input.worker_manifest_digests,
            "sandboxEngineManifest": {
                "id": self.input.sandbox_engine_manifest.id,
                "digest": self.input.sandbox_engine_manifest.digest,
                "mediaType": self.input.sandbox_engine_manifest.media_type,
            },
            "platform": self.input.platform,
            "effectiveControls": self.input.effective_controls,
            "networkMode": self.input.network_mode,
            "generatedAt": self.input.generated_at,
            "signingKeyId": self.input.signing_key_id,
            "attestationDigest": self.attestation_digest,
            "signature": self.signature,
        });
        serde_json::from_value(document).map_err(|_| HarnessRefusal::AttestationBindingIncomplete)
    }
}

/// An attestation whose digest, signature shape and capability posture were
/// checked. Cannot be built outside this module.
///
/// It carries the tenant, key and digest as well as the run: a consumer that had
/// to reach back into the input for them would be reading fields outside the
/// verified result, which is the reflex the first review sanctioned.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerifiedAttestation {
    run_id: String,
    mission_id: String,
    tenant_id: String,
    requested_profile_digest: String,
    effective_profile_digest: String,
    signing_key_id: String,
    attestation_digest: String,
    diverged: bool,
    sealed: Sealed,
}

impl VerifiedAttestation {
    #[must_use]
    pub fn run_id(&self) -> &str {
        &self.run_id
    }

    #[must_use]
    pub fn mission_id(&self) -> &str {
        &self.mission_id
    }

    #[must_use]
    pub fn tenant_id(&self) -> &str {
        &self.tenant_id
    }

    /// The confinement that was asked for, read from the digested document.
    #[must_use]
    pub fn requested_profile_digest(&self) -> &str {
        &self.requested_profile_digest
    }

    /// The confinement actually applied, read from the digested document.
    #[must_use]
    pub fn effective_profile_digest(&self) -> &str {
        &self.effective_profile_digest
    }

    /// Retained so the deferred cryptographic check can run downstream.
    #[must_use]
    pub fn signing_key_id(&self) -> &str {
        &self.signing_key_id
    }

    #[must_use]
    pub fn attestation_digest(&self) -> &str {
        &self.attestation_digest
    }

    #[must_use]
    pub fn diverged(&self) -> bool {
        self.diverged
    }
}

/// Whether an instant is *already* in the one canonical form.
///
/// `SEMANTICS.md` is explicit for this contract: an implementation must reject
/// non-canonical input before computing a digest, and must never parse and
/// silently reserialize it. Normalising — which the previous version did by
/// typing this field — made the digest a function of the parsed value instead of
/// the bytes received: six valid spellings of one instant produced six contract
/// digests but a single crate digest.
///
/// Rejecting instead keeps normalisation an identity on the accepted set, so the
/// bytes received, hashed and emitted are the same. The four-digit year bound is
/// the other half: `chrono` spans ±262143, `format: date-time` does not, and an
/// instant eight thousand years out defeats any freshness window just as an
/// impossible one would.
fn is_canonical_timestamp(value: &str) -> bool {
    let Ok(parsed) = value.parse::<chrono::DateTime<chrono::Utc>>() else {
        return false;
    };
    use chrono::Datelike as _;
    (1..=9999).contains(&parsed.year())
        && value == parsed.to_rfc3339_opts(chrono::SecondsFormat::AutoSi, true)
}

/// Whether a value satisfies the contract type generated for its field.
fn valid<T: FromStr>(value: &str) -> bool {
    value.parse::<T>().is_ok()
}

/// `uniqueItems: true` with the schema's bounds. Order is preserved rather than
/// sorted: two orders are two documents, and silently reordering would make this
/// crate's digest differ from the one an operator computes over the bytes held.
fn bounded<T: FromStr>(values: &[String]) -> bool {
    !values.is_empty()
        && values.len() <= MAX_COLLECTION_ITEMS
        && values
            .iter()
            .enumerate()
            .all(|(index, value)| !values[..index].contains(value))
        && values.iter().all(|value| valid::<T>(value))
}

/// Every binding checked before anything is hashed: hashing an incomplete
/// document would yield a digest that looks authoritative over nothing.
///
/// Each pattern check delegates to the type generated from the schema, so those
/// accepted sets are the contract's rather than a transcription. Two things are
/// NOT generated and stay transcribed here, because typify drops them: the
/// collection bounds below, and the `const` on `schemaVersion` — which is why
/// that value is stamped from [`SCHEMA_VERSION`] rather than accepted from a
/// caller. `generatedAt` has no generated newtype either; it is a typed instant,
/// so its canonical form is the one both hashed and emitted.
fn check_binding(input: &AttestationInput) -> Result<(), HarnessRefusal> {
    let ok = valid::<contract::LibreAiHarnessAttestationV1Id>(&input.id)
        && valid::<contract::LibreAiHarnessAttestationV1TenantId>(&input.tenant_id)
        && valid::<contract::LibreAiHarnessAttestationV1MissionId>(&input.mission_id)
        && valid::<contract::LibreAiHarnessAttestationV1RunId>(&input.run_id)
        && valid::<contract::LibreAiHarnessAttestationV1PlanDigest>(&input.plan_digest)
        && valid::<contract::LibreAiHarnessAttestationV1RequestedProfileDigest>(
            &input.requested_profile_digest,
        )
        && valid::<contract::LibreAiHarnessAttestationV1EffectiveProfileDigest>(
            &input.effective_profile_digest,
        )
        && bounded::<contract::LibreAiHarnessAttestationV1WorkerManifestDigestsItem>(
            &input.worker_manifest_digests,
        )
        && valid::<contract::LibreAiHarnessAttestationV1SandboxEngineManifestId>(
            &input.sandbox_engine_manifest.id,
        )
        && valid::<contract::LibreAiHarnessAttestationV1SandboxEngineManifestDigest>(
            &input.sandbox_engine_manifest.digest,
        )
        && valid::<contract::LibreAiHarnessAttestationV1SandboxEngineManifestMediaType>(
            &input.sandbox_engine_manifest.media_type,
        )
        && bounded::<contract::LibreAiHarnessAttestationV1EffectiveControlsItem>(
            &input.effective_controls,
        )
        && is_canonical_timestamp(&input.generated_at)
        && valid::<contract::LibreAiHarnessAttestationV1SigningKeyId>(&input.signing_key_id);

    if ok {
        Ok(())
    } else {
        Err(HarnessRefusal::AttestationBindingIncomplete)
    }
}

/// A capability the runtime does not grant at this stage.
fn check_capability(input: &AttestationInput) -> Result<(), HarnessRefusal> {
    if input.network_mode == NetworkMode::None {
        Ok(())
    } else {
        Err(HarnessRefusal::CapabilityNotEnabled)
    }
}

/// Deterministic digest of the contract document: JCS, then SHA-256.
///
/// Exposed so a verifier can recompute it without assembling anything. It does
/// **not** gate on capability: hashing is arithmetic, and refusing to digest a
/// document one intends to reject would leave the rejection unprovable.
pub fn attestation_digest(input: &AttestationInput) -> Result<String, HarnessRefusal> {
    check_binding(input)?;
    let document = CanonicalDocument::from(input);
    let canonical =
        serde_jcs::to_string(&document).map_err(|_| HarnessRefusal::CanonicalizationFailed)?;
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

/// Assemble and sign an attestation. Refuses rather than emitting unsigned:
/// a run whose confinement cannot be attested is indistinguishable from an
/// unconfined one.
pub fn assemble_attestation(
    input: AttestationInput,
    signer: &dyn AttestationSigner,
) -> Result<HarnessAttestation, HarnessRefusal> {
    check_capability(&input)?;
    // The document names the key it was signed with; signing it under another
    // declared identity would make that field a claim rather than a binding.
    if input.signing_key_id != signer.key_id() {
        return Err(HarnessRefusal::AttestationBindingIncomplete);
    }
    let attestation_digest = attestation_digest(&input)?;
    let signature = signer
        .sign(&attestation_digest)
        .filter(|candidate| {
            valid::<contract::LibreAiHarnessAttestationV1Signature>(candidate.as_str())
        })
        .ok_or(HarnessRefusal::AttestationUnsigned)?;
    Ok(HarnessAttestation {
        input,
        attestation_digest,
        signature,
        sealed: Sealed,
    })
}

/// Verify that an attestation still binds its fields and claims no capability
/// this stage withholds.
pub fn verify_binding(
    attestation: &HarnessAttestation,
) -> Result<VerifiedAttestation, HarnessRefusal> {
    if !valid::<contract::LibreAiHarnessAttestationV1Signature>(&attestation.signature) {
        return Err(HarnessRefusal::AttestationUnsigned);
    }
    check_capability(&attestation.input)?;
    let recomputed = attestation_digest(&attestation.input)?;
    if recomputed != attestation.attestation_digest {
        return Err(HarnessRefusal::AttestationDigestMismatch);
    }
    Ok(VerifiedAttestation {
        run_id: attestation.input.run_id.clone(),
        mission_id: attestation.input.mission_id.clone(),
        tenant_id: attestation.input.tenant_id.clone(),
        requested_profile_digest: attestation.input.requested_profile_digest.clone(),
        effective_profile_digest: attestation.input.effective_profile_digest.clone(),
        signing_key_id: attestation.input.signing_key_id.clone(),
        attestation_digest: attestation.attestation_digest.clone(),
        diverged: attestation.diverged(),
        sealed: Sealed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Tampering with a stored digest can only be expressed from inside the
    /// module, because the fields are private — which is the point. An
    /// integration test cannot write this, and neither can an attacker
    /// downstream. The path still needs proving, so it is proved here.
    #[test]
    fn refuses_an_attestation_whose_stored_digest_was_rewritten() {
        let input = AttestationInput {
            id: "urn:libre-ai:attestation:a1".to_owned(),
            tenant_id: format!("ten_{}", "a".repeat(16)),
            mission_id: "urn:libre-ai:mission:m1".to_owned(),
            run_id: "urn:libre-ai:run:r1".to_owned(),
            plan_digest: "11".repeat(32),
            requested_profile_digest: "22".repeat(32),
            effective_profile_digest: "22".repeat(32),
            worker_manifest_digests: vec!["33".repeat(32)],
            sandbox_engine_manifest: ArtifactReference {
                id: "urn:libre-ai:manifest:sandbox-engine-1".to_owned(),
                digest: "44".repeat(32),
                media_type: "application/json".to_owned(),
            },
            platform: Platform::MacosAarch64,
            effective_controls: vec!["filesystem_mounts".to_owned()],
            network_mode: NetworkMode::None,
            generated_at: "2026-07-25T10:00:00Z".to_owned(),
            signing_key_id: "harness_key_1".to_owned(),
        };
        let tampered = HarnessAttestation {
            input,
            attestation_digest: "77".repeat(32),
            signature: "s".repeat(86),
            sealed: Sealed,
        };
        assert_eq!(
            verify_binding(&tampered),
            Err(HarnessRefusal::AttestationDigestMismatch)
        );
    }
}
