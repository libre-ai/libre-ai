//! Adversarial suite for the harness attestation core (WP-G3-H01, increment 1).
//!
//! These are written before the controls they attack. An attestation is the only
//! thing standing between "the harness confined this run" and "the harness says
//! it confined this run", so almost every test here asserts a refusal.

use libre_ai_agent_harness::{
    ArtifactReference, AttestationInput, HarnessRefusal, NetworkMode, Platform,
    assemble_attestation, attestation_digest, verify_binding,
};

fn digest(byte: u8) -> String {
    format!("{byte:02x}").repeat(32)
}

fn input() -> AttestationInput {
    AttestationInput {
        id: "urn:libre-ai:attestation:a1".to_owned(),
        tenant_id: format!("ten_{}", "a".repeat(16)),
        mission_id: "urn:libre-ai:mission:m1".to_owned(),
        run_id: "urn:libre-ai:run:r1".to_owned(),
        plan_digest: digest(0x11),
        requested_profile_digest: digest(0x22),
        effective_profile_digest: digest(0x22),
        worker_manifest_digests: vec![digest(0x33)],
        sandbox_engine_manifest: ArtifactReference {
            id: "urn:libre-ai:engine:local-process".to_owned(),
            digest: digest(0x44),
            media_type: "application/vnd.libre-ai.sandbox-engine".to_owned(),
        },
        platform: Platform::MacosAarch64,
        effective_controls: vec!["filesystem_workspace_root".to_owned()],
        network_mode: NetworkMode::None,
        generated_at: "2026-07-25T10:00:00Z".to_owned(),
        signing_key_id: "harness_signing_key_1".to_owned(),
    }
}

#[test]
fn assembles_a_complete_attestation() {
    let attestation = assemble_attestation(input()).expect("a complete input assembles");
    assert_eq!(attestation.requested_profile_digest, digest(0x22));
    assert_eq!(attestation.effective_profile_digest, digest(0x22));
    assert_eq!(attestation.attestation_digest.len(), 64);
    assert!(attestation.signature.is_none());
}

#[test]
fn records_a_divergence_between_requested_and_effective_rather_than_smoothing_it() {
    // A degraded confinement must stay visible. Collapsing the two digests into
    // one would make a silently weakened sandbox indistinguishable from an
    // honoured one — the whole point of attesting.
    let mut degraded = input();
    degraded.effective_profile_digest = digest(0x99);
    let attestation =
        assemble_attestation(degraded).expect("a divergence is recorded, not refused");
    assert_ne!(
        attestation.requested_profile_digest,
        attestation.effective_profile_digest
    );
    assert!(attestation.diverged());
}

#[test]
fn refuses_a_capability_closed_at_this_stage() {
    // ADR-0018 D2 opens a local process and nothing else. The schema can express
    // a gateway; the runtime must refuse it until its own package and review.
    let mut networked = input();
    networked.network_mode = NetworkMode::PrivateGatewayOnly;
    assert_eq!(
        assemble_attestation(networked),
        Err(HarnessRefusal::CapabilityNotEnabled)
    );
}

#[test]
fn refuses_an_incomplete_binding_field_by_field() {
    // Each of these is a binding the attestation claims to carry. Missing any
    // one makes the attestation weaker than it reads, so each is refused.
    let mut no_worker = input();
    no_worker.worker_manifest_digests.clear();
    assert_eq!(
        assemble_attestation(no_worker),
        Err(HarnessRefusal::AttestationBindingIncomplete)
    );

    let mut no_controls = input();
    no_controls.effective_controls.clear();
    assert_eq!(
        assemble_attestation(no_controls),
        Err(HarnessRefusal::AttestationBindingIncomplete)
    );

    let mut no_engine = input();
    no_engine.sandbox_engine_manifest.digest = String::new();
    assert_eq!(
        assemble_attestation(no_engine),
        Err(HarnessRefusal::AttestationBindingIncomplete)
    );

    let mut no_key = input();
    no_key.signing_key_id = String::new();
    assert_eq!(
        assemble_attestation(no_key),
        Err(HarnessRefusal::AttestationBindingIncomplete)
    );
}

#[test]
fn refuses_a_malformed_digest_rather_than_hashing_it() {
    let mut bad = input();
    bad.plan_digest = "not-a-digest".to_owned();
    assert_eq!(
        assemble_attestation(bad),
        Err(HarnessRefusal::AttestationBindingIncomplete)
    );
}

/// One field mutation, boxed so the coverage table below can hold them all.
type Mutation = Box<dyn Fn(&mut AttestationInput)>;

#[test]
fn digest_is_deterministic_and_covers_every_bound_field() {
    // Determinism first: the same input must always hash the same, or an
    // attestation cannot be re-verified by anyone but its author.
    let first = attestation_digest(&input()).expect("digest");
    let second = attestation_digest(&input()).expect("digest");
    assert_eq!(first, second);

    // Then coverage: changing any bound field must move the digest. A field the
    // digest ignores is a field an attacker can rewrite after signing.
    let mutations: Vec<Mutation> = vec![
        Box::new(|i| i.plan_digest = digest(0x55)),
        Box::new(|i| i.requested_profile_digest = digest(0x55)),
        Box::new(|i| i.effective_profile_digest = digest(0x55)),
        Box::new(|i| i.worker_manifest_digests = vec![digest(0x55)]),
        Box::new(|i| i.sandbox_engine_manifest.digest = digest(0x55)),
        Box::new(|i| i.platform = Platform::LinuxX8664),
        Box::new(|i| i.effective_controls = vec!["filesystem_denied_set".to_owned()]),
        Box::new(|i| i.run_id = "urn:libre-ai:run:r2".to_owned()),
        Box::new(|i| i.mission_id = "urn:libre-ai:mission:m2".to_owned()),
        Box::new(|i| i.tenant_id = format!("ten_{}", "b".repeat(16))),
        Box::new(|i| i.generated_at = "2026-07-25T11:00:00Z".to_owned()),
        Box::new(|i| i.signing_key_id = "harness_signing_key_2".to_owned()),
    ];
    for mutate in mutations {
        let mut mutated = input();
        mutate(&mut mutated);
        assert_ne!(
            attestation_digest(&mutated).expect("digest"),
            first,
            "a bound field left the digest unchanged"
        );
    }
}

#[test]
fn refuses_an_unsigned_attestation_at_verification() {
    // Emitting unsigned is allowed — signing is a separate owner ceremony — but
    // consuming unsigned is not. A run whose confinement cannot be attested is
    // indistinguishable from an unconfined one.
    let attestation = assemble_attestation(input()).expect("assembles");
    assert_eq!(
        verify_binding(&attestation),
        Err(HarnessRefusal::AttestationUnsigned)
    );
}

#[test]
fn refuses_an_attestation_whose_digest_was_tampered_with() {
    let mut attestation = assemble_attestation(input()).expect("assembles");
    attestation.signature = Some("s".repeat(86));
    attestation.attestation_digest = digest(0x77);
    assert_eq!(
        verify_binding(&attestation),
        Err(HarnessRefusal::AttestationDigestMismatch)
    );
}

#[test]
fn accepts_a_signed_attestation_whose_digest_still_matches() {
    let mut attestation = assemble_attestation(input()).expect("assembles");
    attestation.signature = Some("s".repeat(86));
    let verified = verify_binding(&attestation).expect("a signed, intact attestation verifies");
    assert_eq!(verified.run_id, "urn:libre-ai:run:r1");
}

#[test]
fn refuses_a_signature_of_the_wrong_shape() {
    // 86 base64url characters is 64 bytes of Ed25519. Anything else is not a
    // signature, and must not reach a verifier that would then trust it.
    let mut attestation = assemble_attestation(input()).expect("assembles");
    attestation.signature = Some("too-short".to_owned());
    assert_eq!(
        verify_binding(&attestation),
        Err(HarnessRefusal::AttestationUnsigned)
    );
}
