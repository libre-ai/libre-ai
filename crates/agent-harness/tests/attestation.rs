//! Adversarial suite for the harness attestation core (WP-G3-H01, increment 1).
//!
//! Written against the controls they attack. An attestation is the only thing
//! standing between "the harness confined this run" and "the harness says it
//! confined this run", so most of what follows asserts a refusal.
//!
//! The first test is the one that matters most: it reproduces the locked golden
//! vector. Its absence is what let a snake_case projection without
//! `schemaVersion` reach review in the first version of this crate.

use libre_ai_agent_harness::{
    ArtifactReference, AttestationInput, AttestationSigner, HarnessRefusal, NetworkMode, Platform,
    SCHEMA_VERSION, assemble_attestation, attestation_digest, verify_binding,
};

/// Stands in for the deferred key ceremony: shape-valid, cryptographically
/// meaningless, and never used outside tests.
struct StubSigner;

impl AttestationSigner for StubSigner {
    fn sign(&self, _digest: &str) -> Option<String> {
        Some("s".repeat(86))
    }
    fn key_id(&self) -> &str {
        "harness_key_1"
    }
}

/// A signer whose key is unavailable.
struct AbsentSigner;

impl AttestationSigner for AbsentSigner {
    fn sign(&self, _digest: &str) -> Option<String> {
        None
    }
    fn key_id(&self) -> &str {
        "harness_key_1"
    }
}

/// A signer returning something that is not a signature.
struct MalformedSigner;

impl AttestationSigner for MalformedSigner {
    fn sign(&self, _digest: &str) -> Option<String> {
        Some("too-short".to_owned())
    }
    fn key_id(&self) -> &str {
        "harness_key_1"
    }
}

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
            id: "urn:libre-ai:manifest:sandbox-engine-1".to_owned(),
            digest: digest(0x44),
            media_type: "application/json".to_owned(),
        },
        platform: Platform::MacosAarch64,
        effective_controls: vec!["filesystem_mounts".to_owned()],
        network_mode: NetworkMode::None,
        generated_at: "2026-07-25T10:00:00Z".to_owned(),
        signing_key_id: "harness_key_1".to_owned(),
    }
}

#[test]
fn reproduces_the_locked_golden_vector() {
    // The oracle. If this passes, an operator holding only contracts/ computes
    // the same digest we do — which is the whole claim of independent
    // verification (WP-G3-H01 acceptance 4).
    let document = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../contracts/fixtures/agent-orchestration-v1/digest-vectors.v1.json"
    ));
    let vectors: serde_json::Value =
        serde_json::from_str(document).expect("digest vectors must parse");
    let vector = vectors["vectors"]
        .as_array()
        .expect("vectors array")
        .iter()
        .find(|entry| entry["id"] == "harness-attestation")
        .expect("the harness-attestation vector must exist");
    let payload = &vector["unsignedPayload"];

    // The vector carries `private-gateway-only`, a capability this stage does not
    // grant. Digesting it must still work: a verifier has to hash a document it
    // is about to refuse, or the refusal is unprovable.
    assert_eq!(payload["networkMode"], "private-gateway-only");
    assert_eq!(payload["schemaVersion"], SCHEMA_VERSION);

    let strings = |key: &str| -> Vec<String> {
        payload[key]
            .as_array()
            .expect("array")
            .iter()
            .map(|value| value.as_str().expect("string").to_owned())
            .collect()
    };
    let text = |key: &str| payload[key].as_str().expect("string").to_owned();

    let from_vector = AttestationInput {
        id: text("id"),
        tenant_id: text("tenantId"),
        mission_id: text("missionId"),
        run_id: text("runId"),
        plan_digest: text("planDigest"),
        requested_profile_digest: text("requestedProfileDigest"),
        effective_profile_digest: text("effectiveProfileDigest"),
        worker_manifest_digests: strings("workerManifestDigests"),
        sandbox_engine_manifest: ArtifactReference {
            id: payload["sandboxEngineManifest"]["id"]
                .as_str()
                .expect("id")
                .to_owned(),
            digest: payload["sandboxEngineManifest"]["digest"]
                .as_str()
                .expect("digest")
                .to_owned(),
            media_type: payload["sandboxEngineManifest"]["mediaType"]
                .as_str()
                .expect("mediaType")
                .to_owned(),
        },
        platform: Platform::LinuxX8664,
        effective_controls: strings("effectiveControls"),
        network_mode: NetworkMode::PrivateGatewayOnly,
        generated_at: text("generatedAt"),
        signing_key_id: text("signingKeyId"),
    };

    assert_eq!(
        attestation_digest(&from_vector).expect("the contract document digests"),
        vector["expectedDigest"].as_str().expect("expected digest"),
        "digest diverges from the locked vector"
    );
}

#[test]
fn platform_serializes_exactly_the_locked_enum_values() {
    // A kebab-case derivation silently produced `linux-x8664`. Pinning the four
    // strings is what keeps that from coming back.
    let pairs = [
        (Platform::LinuxX8664, "\"linux-x86_64\""),
        (Platform::LinuxAarch64, "\"linux-aarch64\""),
        (Platform::MacosX8664, "\"macos-x86_64\""),
        (Platform::MacosAarch64, "\"macos-aarch64\""),
    ];
    for (platform, expected) in pairs {
        assert_eq!(
            serde_json::to_string(&platform).expect("serializes"),
            expected
        );
    }
}

#[test]
fn assembles_and_signs_a_complete_attestation() {
    let attestation = assemble_attestation(input(), &StubSigner).expect("a complete input signs");
    assert_eq!(attestation.attestation_digest().len(), 64);
    assert_eq!(attestation.signature().len(), 86);
    assert!(!attestation.diverged());
}

#[test]
fn records_a_divergence_and_carries_it_through_verification() {
    // The failure the first version shipped: a degraded sandbox could be made to
    // read as an honoured one, because the reported digest lived outside the
    // hashed document. Both values are now inside it, so the divergence survives
    // to the verifier.
    let mut degraded = input();
    degraded.effective_profile_digest = digest(0x99);
    let attestation =
        assemble_attestation(degraded, &StubSigner).expect("a divergence is recorded, not refused");
    assert!(attestation.diverged());

    let verified = verify_binding(&attestation).expect("verifies");
    assert!(verified.diverged());
    assert_eq!(verified.effective_profile_digest(), digest(0x99));
}

#[test]
fn refuses_a_closed_capability_on_both_granting_gates() {
    let mut networked = input();
    networked.network_mode = NetworkMode::PrivateGatewayOnly;
    assert_eq!(
        assemble_attestation(networked.clone(), &StubSigner),
        Err(HarnessRefusal::CapabilityNotEnabled)
    );
    // Digesting is deliberately open — see the golden vector test — so the
    // second gate lives on verification, which is the other place that grants.
    assert!(attestation_digest(&networked).is_ok());
}

#[test]
fn refuses_to_emit_when_the_key_is_unavailable() {
    // The specification requires refusal at emission, not merely at consumption:
    // an unsigned attestation must never exist.
    assert_eq!(
        assemble_attestation(input(), &AbsentSigner),
        Err(HarnessRefusal::AttestationUnsigned)
    );
    assert_eq!(
        assemble_attestation(input(), &MalformedSigner),
        Err(HarnessRefusal::AttestationUnsigned)
    );
}

/// A named field mutation, for tables that report which case failed.
type NamedMutation = (&'static str, Box<dyn Fn(&mut AttestationInput)>);

#[test]
fn refuses_to_sign_under_a_key_the_document_does_not_name() {
    // Otherwise `signingKeyId` is a claim rather than a binding: a verifier
    // would look up the wrong public key and fail for the wrong reason.
    let mut other_key = input();
    other_key.signing_key_id = "harness_key_2".to_owned();
    assert_eq!(
        assemble_attestation(other_key, &StubSigner),
        Err(HarnessRefusal::AttestationBindingIncomplete)
    );
}

#[test]
fn refuses_every_contract_pattern_violation() {
    // Each of these was accepted by the first version, which only checked for
    // emptiness. They are the formats common.v1 pins.
    let cases: Vec<NamedMutation> = vec![
        (
            "id not a urn",
            Box::new(|i: &mut AttestationInput| i.id = "x".to_owned()),
        ),
        (
            "mission id traversal",
            Box::new(|i: &mut AttestationInput| i.mission_id = "../../etc/passwd".to_owned()),
        ),
        (
            "run id newline injection",
            Box::new(|i: &mut AttestationInput| {
                i.run_id = "urn:libre-ai:run:r1\nrunId: r2".to_owned()
            }),
        ),
        (
            "tenant id",
            Box::new(|i: &mut AttestationInput| i.tenant_id = "nope".to_owned()),
        ),
        (
            "timestamp",
            Box::new(|i: &mut AttestationInput| i.generated_at = "yesterday".to_owned()),
        ),
        (
            "signing key id",
            Box::new(|i: &mut AttestationInput| i.signing_key_id = " ".to_owned()),
        ),
        (
            "media type",
            Box::new(|i: &mut AttestationInput| {
                i.sandbox_engine_manifest.media_type = "not a media type".to_owned()
            }),
        ),
        (
            "engine id",
            Box::new(|i: &mut AttestationInput| i.sandbox_engine_manifest.id = "x".to_owned()),
        ),
        (
            "empty control identifier",
            Box::new(|i: &mut AttestationInput| i.effective_controls = vec![String::new()]),
        ),
        (
            "uppercase control identifier",
            Box::new(|i: &mut AttestationInput| {
                i.effective_controls = vec!["NOT_A_CONTROL".to_owned()]
            }),
        ),
        (
            "too many worker manifests",
            Box::new(|i: &mut AttestationInput| {
                i.worker_manifest_digests = (0..200u16).map(|n| digest((n % 256) as u8)).collect();
            }),
        ),
        (
            "duplicate worker manifests",
            Box::new(|i: &mut AttestationInput| {
                i.worker_manifest_digests = vec![digest(0x33), digest(0x33)]
            }),
        ),
        (
            "duplicate controls",
            Box::new(|i: &mut AttestationInput| {
                i.effective_controls = vec!["filesystem_mounts".to_owned(); 2]
            }),
        ),
        (
            "malformed worker digest",
            Box::new(|i: &mut AttestationInput| {
                i.worker_manifest_digests = vec!["not-a-digest".to_owned()]
            }),
        ),
    ];
    for (name, mutate) in cases {
        let mut invalid = input();
        mutate(&mut invalid);
        assert_eq!(
            attestation_digest(&invalid),
            Err(HarnessRefusal::AttestationBindingIncomplete),
            "accepted an invalid {name}"
        );
    }
}

/// One field mutation, boxed so the coverage table can hold them all.
type Mutation = Box<dyn Fn(&mut AttestationInput)>;

#[test]
fn digest_is_deterministic_and_covers_every_bound_field() {
    let first = attestation_digest(&input()).expect("digest");
    assert_eq!(attestation_digest(&input()).expect("digest"), first);

    // Every field of the canonical document, none omitted. A field the digest
    // ignores is a field an attacker rewrites after signing.
    let mutations: Vec<Mutation> = vec![
        Box::new(|i| i.id = "urn:libre-ai:attestation:a2".to_owned()),
        Box::new(|i| i.tenant_id = format!("ten_{}", "b".repeat(16))),
        Box::new(|i| i.mission_id = "urn:libre-ai:mission:m2".to_owned()),
        Box::new(|i| i.run_id = "urn:libre-ai:run:r2".to_owned()),
        Box::new(|i| i.plan_digest = digest(0x55)),
        Box::new(|i| i.requested_profile_digest = digest(0x55)),
        Box::new(|i| i.effective_profile_digest = digest(0x55)),
        Box::new(|i| i.worker_manifest_digests = vec![digest(0x55)]),
        Box::new(|i| i.sandbox_engine_manifest.id = "urn:libre-ai:manifest:other".to_owned()),
        Box::new(|i| i.sandbox_engine_manifest.digest = digest(0x55)),
        Box::new(|i| i.sandbox_engine_manifest.media_type = "application/cbor".to_owned()),
        Box::new(|i| i.platform = Platform::LinuxX8664),
        Box::new(|i| i.effective_controls = vec!["process_isolation".to_owned()]),
        Box::new(|i| i.network_mode = NetworkMode::PrivateGatewayOnly),
        Box::new(|i| i.generated_at = "2026-07-25T11:00:00Z".to_owned()),
        Box::new(|i| i.signing_key_id = "harness_key_2".to_owned()),
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
fn worker_manifest_order_is_part_of_the_document() {
    // JCS sorts object keys, not array elements. Two orders are two documents,
    // and reordering here would make our digest differ from the one an operator
    // computes over the bytes they hold.
    let mut one = input();
    one.worker_manifest_digests = vec![digest(0x33), digest(0x44)];
    let mut other = input();
    other.worker_manifest_digests = vec![digest(0x44), digest(0x33)];
    assert_ne!(
        attestation_digest(&one).expect("digest"),
        attestation_digest(&other).expect("digest")
    );
}

#[test]
fn refusals_carry_stable_namespaced_codes() {
    assert_eq!(
        HarnessRefusal::CapabilityNotEnabled.code(),
        "harness.capability_not_enabled"
    );
    assert_eq!(
        HarnessRefusal::AttestationUnsigned.code(),
        "harness.attestation_unsigned"
    );
    assert_eq!(
        HarnessRefusal::AttestationBindingIncomplete.code(),
        "harness.attestation_binding_incomplete"
    );
}
