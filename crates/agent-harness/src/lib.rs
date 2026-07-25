//! Harness attestation core — the pure half of WP-G3-H01.
//!
//! An attestation is what separates *the harness confined this run* from *the
//! harness says it confined this run*. This crate builds the canonical document
//! the contract defines, digests it, and refuses anything weaker than it would
//! read as. It holds no OS capability: filesystem enforcement and process
//! spawning are later increments with their own reviews (ADR-0018 D2).
//!
//! **The digest is computed over the contract document, not over a private
//! projection.** Fields are camelCase, `schemaVersion` is bound, and the two
//! fields the contract excludes — `attestationDigest` and `signature` — are the
//! only ones left out. That is what makes the golden vector in
//! `contracts/fixtures/agent-orchestration-v1/digest-vectors.v1.json`
//! reproducible here, and therefore what lets an operator holding only
//! `contracts/` re-verify an attestation without any harness-specific rule.
//! The first version of this crate hashed a snake_case projection without
//! `schemaVersion`; three independent reviews rejected it, and the vector below
//! is the test that would have caught it.
//!
//! Three properties carry the rest, each locked by an adversarial test:
//!
//! 1. **Requested and effective stay distinct, and both are bound.** A degraded
//!    sandbox must remain visible, so a divergence is recorded rather than
//!    refused — refusing it would push the caller to report the requested
//!    profile and lose the truth. Both live inside the digested document; there
//!    is no unbound copy a holder could rewrite to hide the divergence.
//! 2. **Verification is not forgeable by shape.** [`VerifiedAttestation`] and
//!    [`HarnessAttestation`] carry a private witness, so neither can be built
//!    outside this module. Holding one means the checks ran, in the same way
//!    `AuthorizationDecision` does in `crates/authz-biscuit`.
//! 3. **A closed capability is refused on both gates that grant.** Assembly and
//!    verification refuse a capability ADR-0018 D2 keeps shut. [`attestation_digest`]
//!    deliberately does not: hashing is arithmetic, and a verifier must be able
//!    to digest a document it will then refuse.
//!
//! What it does not establish: that the signature is cryptographically valid.
//! Signing is a deferred owner ceremony, so this crate takes an
//! [`AttestationSigner`] and refuses to emit anything it cannot get signed.

use serde::Serialize;
use sha2::{Digest, Sha256};

/// Locked by `contracts/schemas/harness-attestation.v1.schema.json`.
pub const SCHEMA_VERSION: &str = "libre-ai.harness-attestation.v1";

const MAX_COLLECTION_ITEMS: usize = 128;

/// Refusals of the attestation core. Each names the failing invariant and never
/// echoes the offending value.
///
/// `AttestationDigestMismatch` and `CanonicalizationFailed` have no entry in the
/// refusal matrix of `docs/apps/harness.md`; their codes are namespaced like the
/// others, and adding them to the locked matrix is a specification amendment for
/// the owner, not something this crate decides.
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

/// Serialized values are spelled out rather than derived: a kebab-case rule
/// cannot produce `x86_64`, because it inserts a separator only before an
/// uppercase letter and then rewrites the underscore. Deriving them silently
/// emitted `linux-x8664`, outside the locked enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Platform {
    #[serde(rename = "linux-x86_64")]
    LinuxX8664,
    #[serde(rename = "linux-aarch64")]
    LinuxAarch64,
    #[serde(rename = "macos-x86_64")]
    MacosX8664,
    #[serde(rename = "macos-aarch64")]
    MacosAarch64,
}

/// Network posture of the run. The contract can express a gateway; ADR-0018 D2
/// keeps it shut, so only [`NetworkMode::None`] is granted at this stage.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum NetworkMode {
    None,
    PrivateGatewayOnly,
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
/// digest. Field order is irrelevant — JCS sorts keys — but the names and the
/// casing are the contract's.
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
    platform: Platform,
    effective_controls: &'a [String],
    network_mode: NetworkMode,
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
            platform: input.platform,
            effective_controls: &input.effective_controls,
            network_mode: input.network_mode,
            generated_at: &input.generated_at,
            signing_key_id: &input.signing_key_id,
        }
    }
}

/// Private witness. Its only purpose is to stop a downstream crate from writing
/// a struct literal and calling it a verified result.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Sealed;

/// Produces the signature over an attestation digest.
///
/// The production key is an owner ceremony, deferred and separate; this crate
/// therefore holds no key material and refuses to emit anything a signer will
/// not sign.
pub trait AttestationSigner {
    /// Signature of `digest`, or `None` when the key is unavailable.
    fn sign(&self, digest: &str) -> Option<String>;
    /// Identifier of the key that will sign, bound into the document.
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
}

/// An attestation whose digest, signature shape and capability posture were
/// checked. Cannot be built outside this module.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerifiedAttestation {
    run_id: String,
    mission_id: String,
    effective_profile_digest: String,
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

    /// The confinement actually applied, read from the digested document.
    #[must_use]
    pub fn effective_profile_digest(&self) -> &str {
        &self.effective_profile_digest
    }

    #[must_use]
    pub fn diverged(&self) -> bool {
        self.diverged
    }
}

/// 64 lowercase hex characters — `common.v1#/$defs/sha256`.
fn is_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// `common.v1#/$defs/urn`: `urn:libre-ai:<kind>:<name>`.
fn is_urn(value: &str) -> bool {
    let Some(rest) = value.strip_prefix("urn:libre-ai:") else {
        return false;
    };
    let Some((kind, name)) = rest.split_once(':') else {
        return false;
    };
    let kind_ok = kind.starts_with(|c: char| c.is_ascii_lowercase())
        && kind
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    let name_ok = !name.is_empty()
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'~' | b'-'));
    kind_ok && name_ok
}

/// `common.v1#/$defs/tenantId`: `^ten_[a-z0-9]{16,64}$`.
fn is_tenant_id(value: &str) -> bool {
    let Some(rest) = value.strip_prefix("ten_") else {
        return false;
    };
    (16..=64).contains(&rest.len())
        && rest
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
}

/// `common.v1#/$defs/identifier`: `^[a-z][a-z0-9_-]{2,127}$`.
fn is_identifier(value: &str) -> bool {
    (3..=128).contains(&value.len())
        && value.starts_with(|c: char| c.is_ascii_lowercase())
        && value
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'_' | b'-'))
}

/// `common.v1#/$defs/timestamp` is `format: date-time`. Checked structurally
/// rather than parsed: this crate has no clock and no date dependency, and an
/// ill-formed instant must not reach the digest.
fn is_timestamp(value: &str) -> bool {
    let bytes = value.as_bytes();
    value.len() == 20
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes[10] == b'T'
        && bytes[13] == b':'
        && bytes[16] == b':'
        && bytes[19] == b'Z'
        && [0, 1, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18]
            .iter()
            .all(|&i| bytes[i].is_ascii_digit())
}

/// `type/subtype`, enough to reject prose without embedding a media-type registry.
fn is_media_type(value: &str) -> bool {
    match value.split_once('/') {
        Some((kind, subtype)) => {
            !kind.is_empty()
                && !subtype.is_empty()
                && !value.contains(' ')
                && value
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'/' | b'.' | b'+' | b'-'))
        }
        None => false,
    }
}

/// Ed25519 in unpadded base64url: 64 bytes are 86 characters. Shape only — a
/// well-shaped string that decodes to something else is caught by the real
/// signature check, which belongs to the key-ceremony increment.
fn is_signature_shaped(value: &str) -> bool {
    value.len() == 86
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_'))
}

/// `uniqueItems: true`. Order is preserved rather than sorted: two orders are
/// two documents, and silently reordering would make this crate's digest differ
/// from the one an operator computes over the document it holds.
fn all_unique(values: &[String]) -> bool {
    values
        .iter()
        .enumerate()
        .all(|(index, value)| !values[..index].contains(value))
}

fn bounded<F: Fn(&str) -> bool>(values: &[String], valid: F) -> bool {
    !values.is_empty()
        && values.len() <= MAX_COLLECTION_ITEMS
        && all_unique(values)
        && values.iter().all(|value| valid(value))
}

/// Every binding checked before anything is hashed: hashing an incomplete
/// document would yield a digest that looks authoritative over nothing.
fn check_binding(input: &AttestationInput) -> Result<(), HarnessRefusal> {
    let ok = is_urn(&input.id)
        && is_tenant_id(&input.tenant_id)
        && is_urn(&input.mission_id)
        && is_urn(&input.run_id)
        && is_sha256(&input.plan_digest)
        && is_sha256(&input.requested_profile_digest)
        && is_sha256(&input.effective_profile_digest)
        && bounded(&input.worker_manifest_digests, is_sha256)
        && is_urn(&input.sandbox_engine_manifest.id)
        && is_sha256(&input.sandbox_engine_manifest.digest)
        && is_media_type(&input.sandbox_engine_manifest.media_type)
        && bounded(&input.effective_controls, is_identifier)
        && is_timestamp(&input.generated_at)
        && is_identifier(&input.signing_key_id);

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
    // The document names the key it was signed with; signing it with another
    // would make that field a claim rather than a binding.
    if input.signing_key_id != signer.key_id() {
        return Err(HarnessRefusal::AttestationBindingIncomplete);
    }
    let attestation_digest = attestation_digest(&input)?;
    let signature = signer
        .sign(&attestation_digest)
        .filter(|candidate| is_signature_shaped(candidate))
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
///
/// Signature *validity* against a public key belongs to the key-ceremony
/// increment; what is checked here is shape, capability posture, and that
/// nothing was rewritten after the digest was produced.
pub fn verify_binding(
    attestation: &HarnessAttestation,
) -> Result<VerifiedAttestation, HarnessRefusal> {
    if !is_signature_shaped(&attestation.signature) {
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
        effective_profile_digest: attestation.input.effective_profile_digest.clone(),
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
