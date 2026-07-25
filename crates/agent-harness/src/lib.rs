//! Harness attestation core — the pure half of WP-G3-H01.
//!
//! An attestation is what separates *the harness confined this run* from *the
//! harness says it confined this run*. This crate assembles one, binds every
//! field a verifier depends on into a single deterministic digest, and refuses
//! anything weaker than it would read as. It holds no OS capability: filesystem
//! enforcement and process spawning belong to later increments with their own
//! reviews (ADR-0018 D2).
//!
//! Three properties carry the whole thing, and each is locked by an adversarial
//! test written before the code:
//!
//! 1. **Requested and effective stay distinct.** A degraded sandbox must remain
//!    visible. Collapsing the two profile digests into one would make a silently
//!    weakened confinement indistinguishable from an honoured one — which is
//!    exactly what attesting exists to prevent. A divergence is therefore
//!    recorded, never refused: refusing it here would push the caller to report
//!    the requested profile and lose the truth.
//! 2. **The digest covers every bound field.** A field the digest ignores is a
//!    field an attacker rewrites after signing. The coverage test mutates each
//!    field in turn and requires the digest to move.
//! 3. **Unsigned emits, but never verifies.** Signing is a deferred owner
//!    ceremony, so assembly yields an unsigned attestation. Consuming one is
//!    refused: a run whose confinement cannot be attested is indistinguishable
//!    from an unconfined run, and is treated as such.
//!
//! Canonicalization is JCS (RFC 8785) over the bound fields, then SHA-256 — the
//! same pairing the socle already uses for policy evaluation and artifact
//! digests, so a verifier needs no harness-specific hashing rule.

use serde::Serialize;
use sha2::{Digest, Sha256};

/// Refusals of the attestation core. Closed set; each names the failing
/// invariant and never echoes the offending value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HarnessRefusal {
    /// A binding the attestation claims to carry is absent or malformed.
    AttestationBindingIncomplete,
    /// A capability closed by ADR-0018 D2 was requested.
    CapabilityNotEnabled,
    /// The attestation carries no signature of the expected shape.
    AttestationUnsigned,
    /// The recorded digest does not match the bound fields.
    AttestationDigestMismatch,
    /// Canonical serialization failed; nothing is hashed on a partial document.
    CanonicalizationFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Platform {
    LinuxX8664,
    LinuxAarch64,
    MacosX8664,
    MacosAarch64,
}

/// Network posture of the run. Only [`NetworkMode::None`] is enabled at this
/// stage; the contract can express a gateway, and the runtime refuses it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum NetworkMode {
    None,
    PrivateGatewayOnly,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ArtifactReference {
    pub id: String,
    pub digest: String,
    pub media_type: String,
}

/// Everything an attestation binds, before canonicalization.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
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

/// An assembled attestation. `signature` is `None` until the deferred signing
/// ceremony provides a key; verification refuses it in that state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HarnessAttestation {
    pub input: AttestationInput,
    pub requested_profile_digest: String,
    pub effective_profile_digest: String,
    pub attestation_digest: String,
    pub signature: Option<String>,
}

impl HarnessAttestation {
    /// Whether the applied confinement differs from the one that was requested.
    /// Callers surface this; the core records it without judging it.
    #[must_use]
    pub fn diverged(&self) -> bool {
        self.requested_profile_digest != self.effective_profile_digest
    }
}

/// An attestation whose digest and signature shape have been checked. It cannot
/// be built outside this module, so holding one means the checks ran.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerifiedAttestation {
    pub run_id: String,
    pub mission_id: String,
    pub effective_profile_digest: String,
}

/// 64 lowercase hex characters, matching `common.v1#/$defs/sha256`.
fn is_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// Ed25519 in base64url without padding: 64 bytes become exactly 86 characters.
fn is_signature_shaped(value: &str) -> bool {
    value.len() == 86
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// Every binding checked before anything is hashed. Hashing an incomplete
/// document would produce a digest that looks authoritative over nothing.
fn check_binding(input: &AttestationInput) -> Result<(), HarnessRefusal> {
    let digests_valid = is_sha256(&input.plan_digest)
        && is_sha256(&input.requested_profile_digest)
        && is_sha256(&input.effective_profile_digest)
        && is_sha256(&input.sandbox_engine_manifest.digest)
        && !input.worker_manifest_digests.is_empty()
        && input.worker_manifest_digests.iter().all(|d| is_sha256(d));

    let identifiers_present = !input.id.is_empty()
        && !input.tenant_id.is_empty()
        && !input.mission_id.is_empty()
        && !input.run_id.is_empty()
        && !input.sandbox_engine_manifest.id.is_empty()
        && !input.sandbox_engine_manifest.media_type.is_empty()
        && !input.generated_at.is_empty()
        && !input.signing_key_id.is_empty()
        && !input.effective_controls.is_empty();

    if digests_valid && identifiers_present {
        Ok(())
    } else {
        Err(HarnessRefusal::AttestationBindingIncomplete)
    }
}

/// Deterministic digest over every bound field: JCS, then SHA-256.
///
/// Exposed so a verifier can recompute it without reassembling an attestation.
pub fn attestation_digest(input: &AttestationInput) -> Result<String, HarnessRefusal> {
    check_binding(input)?;
    let canonical =
        serde_jcs::to_string(input).map_err(|_| HarnessRefusal::CanonicalizationFailed)?;
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

/// Assemble an unsigned attestation from a complete, enabled input.
pub fn assemble_attestation(input: AttestationInput) -> Result<HarnessAttestation, HarnessRefusal> {
    // Capability check before binding: a closed capability is refused on its own
    // terms, not reported as a malformed document.
    if input.network_mode != NetworkMode::None {
        return Err(HarnessRefusal::CapabilityNotEnabled);
    }
    let attestation_digest = attestation_digest(&input)?;
    Ok(HarnessAttestation {
        requested_profile_digest: input.requested_profile_digest.clone(),
        effective_profile_digest: input.effective_profile_digest.clone(),
        attestation_digest,
        signature: None,
        input,
    })
}

/// Verify that an attestation is signed and that its digest still binds its
/// fields. Signature *validity* against a public key belongs to the signing
/// ceremony increment; what is checked here is that a signature of the right
/// shape exists and that nothing was rewritten after it was produced.
pub fn verify_binding(
    attestation: &HarnessAttestation,
) -> Result<VerifiedAttestation, HarnessRefusal> {
    match attestation.signature.as_deref() {
        Some(signature) if is_signature_shaped(signature) => {}
        _ => return Err(HarnessRefusal::AttestationUnsigned),
    }
    let recomputed = attestation_digest(&attestation.input)?;
    if recomputed != attestation.attestation_digest {
        return Err(HarnessRefusal::AttestationDigestMismatch);
    }
    Ok(VerifiedAttestation {
        run_id: attestation.input.run_id.clone(),
        mission_id: attestation.input.mission_id.clone(),
        effective_profile_digest: attestation.effective_profile_digest.clone(),
    })
}
