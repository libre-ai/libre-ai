use biscuit_auth::builder::{BlockBuilder, Term, date, fact, string};
use biscuit_auth::{Biscuit, KeyPair};
use libre_ai_authz_biscuit::{
    AttenuationRequest, AuthorizationContext, BiscuitIssuer, CanonicalPolicy, IssuanceRequest,
    RevocationChecker, RevocationRecord, RevocationStore, RevocationStoreUnavailable,
    SensitiveToken, VerificationKey, VerificationKeyRing, VerificationKeyStatus, authorize,
};
use std::collections::{BTreeSet, HashMap};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const USER: &str = "usr_0123456789abcdef";
const OTHER_USER: &str = "usr_fedcba9876543210";
const TENANT: &str = "ten_0123456789abcdef";
const OTHER_TENANT: &str = "ten_fedcba9876543210";
const RESOURCE: &str = "mission:0123456789abcdef";
const AUTHORITY_TEMPLATE: &str = include_str!("../../../contracts/authz/authority-v1.datalog");

#[derive(Default)]
struct MemoryRevocations {
    revoked: BTreeSet<String>,
    unavailable: bool,
    checks: usize,
    fail_after_checks: Option<usize>,
}

impl RevocationStore for MemoryRevocations {
    fn is_revoked(&mut self, root_block_id: &str) -> Result<bool, RevocationStoreUnavailable> {
        self.checks += 1;
        if self.unavailable
            || self
                .fail_after_checks
                .is_some_and(|allowed| self.checks > allowed)
        {
            return Err(RevocationStoreUnavailable);
        }
        Ok(self.revoked.contains(root_block_id))
    }

    fn revoke(&mut self, record: RevocationRecord) -> Result<(), RevocationStoreUnavailable> {
        if self.unavailable {
            return Err(RevocationStoreUnavailable);
        }
        self.revoked.insert(record.root_block_id().to_owned());
        Ok(())
    }
}

fn at(seconds: u64) -> SystemTime {
    UNIX_EPOCH + Duration::from_secs(1_900_000_000 + seconds)
}

fn operations(values: &[&str]) -> BTreeSet<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

fn issuer_and_ring(key_id: u32, now: SystemTime) -> (BiscuitIssuer, VerificationKeyRing) {
    let key_pair = KeyPair::new();
    let public_key = key_pair.public();
    let issuer = BiscuitIssuer::new(
        key_id,
        key_pair,
        Duration::from_secs(900),
        now - Duration::from_secs(1),
    )
    .unwrap();
    let ring = VerificationKeyRing::new(VerificationKey {
        key_id,
        public_key,
        valid_from: now.checked_sub(Duration::from_secs(1)).unwrap(),
        valid_until: None,
        status: VerificationKeyStatus::Current,
    })
    .unwrap();
    (issuer, ring)
}

fn issue(
    issuer: &BiscuitIssuer,
    now: SystemTime,
    role: &str,
    allowed_operations: &[&str],
    ttl: u64,
) -> libre_ai_authz_biscuit::BoundedBiscuit {
    issuer
        .issue(
            IssuanceRequest {
                user_id: USER.to_owned(),
                tenant_id: TENANT.to_owned(),
                role: role.to_owned(),
                resource: RESOURCE.to_owned(),
                operations: operations(allowed_operations),
                ttl: Duration::from_secs(ttl),
            },
            now,
        )
        .unwrap()
}

fn mission_context(now: SystemTime, operation: &str) -> AuthorizationContext {
    AuthorizationContext {
        policy: CanonicalPolicy::Missions,
        resource: RESOURCE.to_owned(),
        operation: operation.to_owned(),
        request_tenant: TENANT.to_owned(),
        resource_tenant: TENANT.to_owned(),
        audience: None,
        contribution_owner_user_id: None,
        now,
    }
}

fn checker() -> RevocationChecker<MemoryRevocations> {
    RevocationChecker::new(MemoryRevocations::default(), Duration::from_secs(30)).unwrap()
}

#[test]
fn minimal_mission_authorization_is_verified_and_deny_by_default() {
    let now = at(0);
    let (issuer, ring) = issuer_and_ring(1, now);
    let token = issue(&issuer, now, "requester", &["read", "propose"], 300)
        .serialize()
        .unwrap();
    let mut revocations = checker();

    let decision = authorize(
        &token.token,
        mission_context(now + Duration::from_secs(1), "read"),
        &ring,
        &mut revocations,
    )
    .unwrap();
    assert_eq!(decision.principal.user_id, USER);
    assert_eq!(decision.principal.tenant_id, TENANT);
    assert_eq!(decision.principal.role, "requester");
    assert_eq!(decision.root_block_id, token.root_block_id());

    let error = authorize(
        &token.token,
        mission_context(now + Duration::from_secs(2), "delete"),
        &ring,
        &mut revocations,
    )
    .unwrap_err();
    assert_eq!(error.code, "auth.operation_denied");
    assert_eq!(error.root_block_id.as_deref(), Some(token.root_block_id()));

    let wrong_role = issue(&issuer, now, "observer", &["read"], 300)
        .serialize()
        .unwrap();
    assert_eq!(
        authorize(
            &wrong_role.token,
            mission_context(now + Duration::from_secs(2), "read"),
            &ring,
            &mut revocations,
        )
        .unwrap_err()
        .code,
        "auth.operation_denied"
    );
}

#[test]
fn tenant_role_owner_and_expiration_fail_closed() {
    let now = at(100);
    let (issuer, ring) = issuer_and_ring(2, now);
    let token = issue(&issuer, now, "participant", &["read"], 60)
        .serialize()
        .unwrap();
    let mut revocations = checker();

    let mut cross_tenant = mission_context(now + Duration::from_secs(1), "read");
    cross_tenant.policy = CanonicalPolicy::Sessions;
    cross_tenant.audience = Some("private".to_owned());
    cross_tenant.contribution_owner_user_id = Some(USER.to_owned());
    cross_tenant.request_tenant = OTHER_TENANT.to_owned();
    cross_tenant.resource_tenant = OTHER_TENANT.to_owned();
    assert_eq!(
        authorize(&token.token, cross_tenant, &ring, &mut revocations)
            .unwrap_err()
            .code,
        "auth.tenant_mismatch"
    );

    let mut not_owner = mission_context(now + Duration::from_secs(2), "read");
    not_owner.policy = CanonicalPolicy::Sessions;
    not_owner.audience = Some("private".to_owned());
    not_owner.contribution_owner_user_id = Some(OTHER_USER.to_owned());
    assert_eq!(
        authorize(&token.token, not_owner, &ring, &mut revocations)
            .unwrap_err()
            .code,
        "auth.operation_denied"
    );

    let mut owner = mission_context(now + Duration::from_secs(3), "read");
    owner.policy = CanonicalPolicy::Sessions;
    owner.audience = Some("private".to_owned());
    owner.contribution_owner_user_id = Some(USER.to_owned());
    authorize(&token.token, owner, &ring, &mut revocations).unwrap();

    assert_eq!(
        authorize(
            &token.token,
            AuthorizationContext {
                policy: CanonicalPolicy::Sessions,
                resource: RESOURCE.to_owned(),
                operation: "read".to_owned(),
                request_tenant: TENANT.to_owned(),
                resource_tenant: TENANT.to_owned(),
                audience: Some("private".to_owned()),
                contribution_owner_user_id: Some(USER.to_owned()),
                now: now + Duration::from_secs(61),
            },
            &ring,
            &mut revocations,
        )
        .unwrap_err()
        .code,
        "auth.biscuit_invalid"
    );
}

#[test]
fn tenant_witness_lifetime_and_transport_boundaries_fail_closed() {
    let now = at(150);
    let (issuer, ring) = issuer_and_ring(22, now);
    let token = issue(&issuer, now, "requester", &["read"], 900)
        .serialize()
        .unwrap();

    authorize(
        &token.token,
        mission_context(now, "read"),
        &ring,
        &mut checker(),
    )
    .unwrap();
    assert_eq!(
        authorize(
            &token.token,
            mission_context(now - Duration::from_secs(1), "read"),
            &ring,
            &mut checker(),
        )
        .unwrap_err()
        .code,
        "auth.biscuit_invalid"
    );

    let mut divergent_tenant_witness = mission_context(now + Duration::from_secs(1), "read");
    divergent_tenant_witness.resource_tenant = OTHER_TENANT.to_owned();
    let mismatch = authorize(
        &token.token,
        divergent_tenant_witness,
        &ring,
        &mut checker(),
    )
    .unwrap_err();
    assert_eq!(mismatch.code, "auth.tenant_mismatch");
    assert!(mismatch.root_block_id.is_none());

    let malformed = SensitiveToken::from_transport("not-base64".to_owned()).unwrap();
    assert_eq!(
        authorize(
            &malformed,
            mission_context(now, "read"),
            &ring,
            &mut checker(),
        )
        .unwrap_err()
        .code,
        "auth.biscuit_invalid"
    );
}

#[test]
fn offline_attenuation_can_only_reduce_authority() {
    let now = at(200);
    let (issuer, ring) = issuer_and_ring(3, now);
    let parent = issue(&issuer, now, "requester", &["read", "propose"], 300);
    let parent_serialized = parent.serialize().unwrap();
    let parent_root = parent_serialized.root_block_id().to_owned();
    let root_family_expires_at = parent_serialized.revocation_target().expires_at();
    assert_eq!(
        parent
            .attenuate(
                AttenuationRequest {
                    tenant_id: TENANT.to_owned(),
                    resource: RESOURCE.to_owned(),
                    operations: operations(&["read"]),
                    ttl: Duration::ZERO,
                },
                now + Duration::from_secs(1),
            )
            .unwrap_err()
            .code,
        "auth.biscuit_invalid"
    );
    let child = parent
        .attenuate(
            AttenuationRequest {
                tenant_id: TENANT.to_owned(),
                resource: RESOURCE.to_owned(),
                operations: operations(&["read"]),
                ttl: Duration::from_secs(120),
            },
            now + Duration::from_secs(1),
        )
        .unwrap();

    assert_eq!(
        child
            .attenuate(
                AttenuationRequest {
                    tenant_id: TENANT.to_owned(),
                    resource: RESOURCE.to_owned(),
                    operations: operations(&["read", "propose"]),
                    ttl: Duration::from_secs(100),
                },
                now + Duration::from_secs(2),
            )
            .unwrap_err()
            .code,
        "auth.biscuit_invalid"
    );
    for request in [
        AttenuationRequest {
            tenant_id: OTHER_TENANT.to_owned(),
            resource: RESOURCE.to_owned(),
            operations: operations(&["read"]),
            ttl: Duration::from_secs(100),
        },
        AttenuationRequest {
            tenant_id: TENANT.to_owned(),
            resource: "mission:fedcba9876543210".to_owned(),
            operations: operations(&["read"]),
            ttl: Duration::from_secs(100),
        },
        AttenuationRequest {
            tenant_id: TENANT.to_owned(),
            resource: RESOURCE.to_owned(),
            operations: operations(&["read"]),
            ttl: Duration::from_secs(300),
        },
    ] {
        assert_eq!(
            parent
                .attenuate(request, now + Duration::from_secs(2))
                .unwrap_err()
                .code,
            "auth.biscuit_invalid"
        );
    }

    let child = child.serialize().unwrap();
    assert_eq!(child.root_block_id(), parent_root);
    assert!(child.expires_at() < child.revocation_target().expires_at());
    assert_eq!(
        child.revocation_target().expires_at(),
        root_family_expires_at
    );
    let mut revocations = checker();
    authorize(
        &child.token,
        mission_context(now + Duration::from_secs(3), "read"),
        &ring,
        &mut revocations,
    )
    .unwrap();
    assert_eq!(
        authorize(
            &child.token,
            mission_context(now + Duration::from_secs(4), "propose"),
            &ring,
            &mut revocations,
        )
        .unwrap_err()
        .code,
        "auth.operation_denied"
    );
}

#[test]
fn holder_appended_role_fact_cannot_expand_authority() {
    let now = at(250);
    let (issuer, ring) = issuer_and_ring(31, now);
    let token = issue(&issuer, now, "requester", &["approve"], 300)
        .serialize()
        .unwrap();
    let verified = Biscuit::from_base64(token.token.expose(), issuer.public_key()).unwrap();
    let mut forged_block = BlockBuilder::new();
    forged_block
        .add_fact(fact("role", &[string(USER), string("approver")]))
        .unwrap();
    let forged = verified.append(forged_block).unwrap().to_base64().unwrap();
    let forged = SensitiveToken::from_transport(forged).unwrap();

    assert_eq!(
        authorize(
            &forged,
            mission_context(now + Duration::from_secs(1), "approve"),
            &ring,
            &mut checker(),
        )
        .unwrap_err()
        .code,
        "auth.operation_denied"
    );
}

#[test]
fn revocation_is_immediate_and_store_outage_denies() {
    let now = at(300);
    let (issuer, ring) = issuer_and_ring(4, now);
    let token = issue(&issuer, now, "requester", &["read"], 300)
        .serialize()
        .unwrap();
    let mut revocations = checker();
    let decision = authorize(
        &token.token,
        mission_context(now + Duration::from_secs(1), "read"),
        &ring,
        &mut revocations,
    )
    .unwrap();

    revocations
        .revoke(
            decision.revocation_target(),
            "session.logout".to_owned(),
            now + Duration::from_secs(2),
        )
        .unwrap();
    let error = authorize(
        &token.token,
        mission_context(now + Duration::from_secs(2), "read"),
        &ring,
        &mut revocations,
    )
    .unwrap_err();
    assert_eq!(error.code, "auth.biscuit_revoked");

    let mut unavailable = RevocationChecker::new(
        MemoryRevocations {
            unavailable: true,
            ..MemoryRevocations::default()
        },
        Duration::from_secs(30),
    )
    .unwrap();
    let error = authorize(
        &token.token,
        mission_context(now + Duration::from_secs(3), "read"),
        &ring,
        &mut unavailable,
    )
    .unwrap_err();
    assert_eq!(error.code, "auth.biscuit_invalid");
}

#[test]
fn two_key_rotation_has_a_bounded_overlap() {
    let now = at(400);
    let (old_issuer, mut ring) = issuer_and_ring(10, now);
    let old_token = issue(&old_issuer, now, "requester", &["read"], 900)
        .serialize()
        .unwrap();

    let mut short_overlap_ring = ring.clone();
    let short_overlap_pair = KeyPair::new();
    assert_eq!(
        short_overlap_ring
            .begin_rotation(
                VerificationKey {
                    key_id: 11,
                    public_key: short_overlap_pair.public(),
                    valid_from: now + Duration::from_secs(10),
                    valid_until: None,
                    status: VerificationKeyStatus::Current,
                },
                now + Duration::from_secs(909),
                now,
            )
            .unwrap_err()
            .code,
        "auth.key_unavailable"
    );

    let mut backdated_ring = ring.clone();
    let backdated_pair = KeyPair::new();
    assert_eq!(
        backdated_ring
            .begin_rotation(
                VerificationKey {
                    key_id: 11,
                    public_key: backdated_pair.public(),
                    valid_from: now - Duration::from_secs(2),
                    valid_until: None,
                    status: VerificationKeyStatus::Current,
                },
                now + Duration::from_secs(920),
                now,
            )
            .unwrap_err()
            .code,
        "auth.key_unavailable"
    );

    let mut exact_overlap_ring = ring.clone();
    let exact_overlap_pair = KeyPair::new();
    exact_overlap_ring
        .begin_rotation(
            VerificationKey {
                key_id: 11,
                public_key: exact_overlap_pair.public(),
                valid_from: now + Duration::from_secs(10),
                valid_until: None,
                status: VerificationKeyStatus::Current,
            },
            now + Duration::from_secs(910),
            now,
        )
        .unwrap();

    let stale_current_pair = KeyPair::new();
    let mut stale_ring = VerificationKeyRing::new(VerificationKey {
        key_id: 20,
        public_key: stale_current_pair.public(),
        valid_from: now - Duration::from_secs(2_000),
        valid_until: None,
        status: VerificationKeyStatus::Current,
    })
    .unwrap();
    let stale_new_pair = KeyPair::new();
    assert_eq!(
        stale_ring
            .begin_rotation(
                VerificationKey {
                    key_id: 21,
                    public_key: stale_new_pair.public(),
                    valid_from: now - Duration::from_secs(1_000),
                    valid_until: None,
                    status: VerificationKeyStatus::Current,
                },
                now - Duration::from_secs(100),
                now,
            )
            .unwrap_err()
            .code,
        "auth.key_unavailable"
    );

    let new_pair = KeyPair::new();
    let new_public = new_pair.public();
    let new_issuer = BiscuitIssuer::new(
        11,
        new_pair,
        Duration::from_secs(900),
        now + Duration::from_secs(10),
    )
    .unwrap();
    assert_eq!(
        new_issuer
            .issue(
                IssuanceRequest {
                    user_id: USER.to_owned(),
                    tenant_id: TENANT.to_owned(),
                    role: "requester".to_owned(),
                    resource: RESOURCE.to_owned(),
                    operations: operations(&["read"]),
                    ttl: Duration::from_secs(300),
                },
                now,
            )
            .unwrap_err()
            .code,
        "auth.key_unavailable"
    );
    ring.begin_rotation(
        VerificationKey {
            key_id: 11,
            public_key: new_public,
            valid_from: now + Duration::from_secs(10),
            valid_until: None,
            status: VerificationKeyStatus::Current,
        },
        now + Duration::from_secs(920),
        now,
    )
    .unwrap();
    assert_eq!(ring.public_keys().len(), 2);

    let mut retiring_survivor = ring.clone();
    retiring_survivor.revoke_key(11);
    let replacement_pair = KeyPair::new();
    assert_eq!(
        retiring_survivor
            .begin_rotation(
                VerificationKey {
                    key_id: 12,
                    public_key: replacement_pair.public(),
                    valid_from: now + Duration::from_secs(20),
                    valid_until: None,
                    status: VerificationKeyStatus::Current,
                },
                now + Duration::from_secs(920),
                now + Duration::from_secs(20),
            )
            .unwrap_err()
            .code,
        "auth.key_unavailable"
    );

    let new_token = issue(
        &new_issuer,
        now + Duration::from_secs(10),
        "requester",
        &["read"],
        900,
    )
    .serialize()
    .unwrap();
    let mut revocations = checker();
    authorize(
        &new_token.token,
        mission_context(now + Duration::from_secs(10), "read"),
        &ring,
        &mut revocations,
    )
    .unwrap();
    authorize(
        &old_token.token,
        mission_context(now + Duration::from_secs(20), "read"),
        &ring,
        &mut revocations,
    )
    .unwrap();
    authorize(
        &new_token.token,
        mission_context(now + Duration::from_secs(20), "read"),
        &ring,
        &mut revocations,
    )
    .unwrap();

    let third_pair = KeyPair::new();
    assert_eq!(
        ring.begin_rotation(
            VerificationKey {
                key_id: 12,
                public_key: third_pair.public(),
                valid_from: now + Duration::from_secs(20),
                valid_until: None,
                status: VerificationKeyStatus::Current,
            },
            now + Duration::from_secs(930),
            now + Duration::from_secs(20),
        )
        .unwrap_err()
        .code,
        "auth.key_unavailable"
    );
    assert_eq!(
        ring.finish_rotation(now + Duration::from_secs(919))
            .unwrap_err()
            .code,
        "auth.key_unavailable"
    );
    ring.finish_rotation(now + Duration::from_secs(920))
        .unwrap();

    assert_eq!(
        authorize(
            &old_token.token,
            mission_context(now + Duration::from_secs(920), "read"),
            &ring,
            &mut revocations,
        )
        .unwrap_err()
        .code,
        "auth.key_unavailable"
    );
    let post_rotation = issue(
        &new_issuer,
        now + Duration::from_secs(920),
        "requester",
        &["read"],
        300,
    )
    .serialize()
    .unwrap();
    authorize(
        &post_rotation.token,
        mission_context(now + Duration::from_secs(921), "read"),
        &ring,
        &mut revocations,
    )
    .unwrap();

    for (key_id, public_key) in [(10, KeyPair::new().public()), (13, new_issuer.public_key())] {
        assert_eq!(
            ring.begin_rotation(
                VerificationKey {
                    key_id,
                    public_key,
                    valid_from: now + Duration::from_secs(922),
                    valid_until: None,
                    status: VerificationKeyStatus::Current,
                },
                now + Duration::from_secs(1_300),
                now + Duration::from_secs(922),
            )
            .unwrap_err()
            .code,
            "auth.key_unavailable"
        );
    }
}

#[test]
fn malformed_signed_authority_without_tenant_or_expiry_is_denied() {
    let now = at(500);
    let key_pair = KeyPair::new();
    let public_key = key_pair.public();
    let ring = VerificationKeyRing::new(VerificationKey {
        key_id: 20,
        public_key,
        valid_from: now - Duration::from_secs(1),
        valid_until: None,
        status: VerificationKeyStatus::Current,
    })
    .unwrap();

    let mut parameters = HashMap::<String, Term>::new();
    parameters.insert("user".to_owned(), USER.into());
    parameters.insert("tenant".to_owned(), TENANT.into());
    parameters.insert("role".to_owned(), "requester".into());
    parameters.insert(
        "expires_at".to_owned(),
        (now + Duration::from_secs(300)).into(),
    );
    let mut authority_only_builder = Biscuit::builder();
    authority_only_builder.set_root_key_id(20);
    authority_only_builder
        .add_code_with_params(AUTHORITY_TEMPLATE, parameters, HashMap::new())
        .unwrap();
    let authority_only = authority_only_builder.build(&key_pair).unwrap();
    let root_only = authority_only.to_base64().unwrap();
    let empty_attenuation = authority_only
        .append(BlockBuilder::new())
        .unwrap()
        .to_base64()
        .unwrap();
    for malformed in [root_only, empty_attenuation] {
        let malformed = SensitiveToken::from_transport(malformed).unwrap();
        assert_eq!(
            authorize(
                &malformed,
                mission_context(now + Duration::from_secs(1), "export"),
                &ring,
                &mut checker(),
            )
            .unwrap_err()
            .code,
            "auth.biscuit_invalid"
        );
    }

    let mut without_expiry_builder = Biscuit::builder();
    without_expiry_builder.set_root_key_id(20);
    without_expiry_builder
        .add_fact(fact("user", &[string(USER)]))
        .unwrap();
    without_expiry_builder
        .add_fact(fact("tenant", &[string(TENANT)]))
        .unwrap();
    without_expiry_builder
        .add_fact(fact("role", &[string(USER), string("requester")]))
        .unwrap();
    let without_expiry = without_expiry_builder.build(&key_pair).unwrap();

    let mut without_tenant_builder = Biscuit::builder();
    without_tenant_builder.set_root_key_id(20);
    without_tenant_builder
        .add_fact(fact("user", &[string(USER)]))
        .unwrap();
    without_tenant_builder
        .add_fact(fact("role", &[string(USER), string("requester")]))
        .unwrap();
    without_tenant_builder
        .add_fact(fact(
            "expires_at",
            &[date(&(now + Duration::from_secs(300)))],
        ))
        .unwrap();
    let without_tenant = without_tenant_builder.build(&key_pair).unwrap();

    for malformed in [without_expiry, without_tenant] {
        let token = SensitiveToken::from_transport(malformed.to_base64().unwrap()).unwrap();
        let mut revocations = checker();
        assert_eq!(
            authorize(
                &token,
                mission_context(now + Duration::from_secs(1), "read"),
                &ring,
                &mut revocations,
            )
            .unwrap_err()
            .code,
            "auth.biscuit_invalid"
        );
    }
}

#[test]
fn session_audience_is_required_and_debug_output_is_redacted() {
    let now = at(600);
    let (issuer, ring) = issuer_and_ring(30, now);
    let token = issue(&issuer, now, "participant", &["read"], 300)
        .serialize()
        .unwrap();
    let mut context = mission_context(now + Duration::from_secs(1), "read");
    context.policy = CanonicalPolicy::Sessions;
    context.resource = RESOURCE.to_owned();
    let mut revocations = checker();
    assert_eq!(
        authorize(&token.token, context.clone(), &ring, &mut revocations)
            .unwrap_err()
            .code,
        "auth.operation_denied"
    );
    context.audience = Some("session".to_owned());
    let decision = authorize(&token.token, context, &ring, &mut revocations).unwrap();

    let token_debug = format!("{:?}", token.token);
    let decision_debug = format!("{decision:?}");
    let issuer_debug = format!("{issuer:?}");
    for debug in [&token_debug, &decision_debug, &issuer_debug] {
        assert!(!debug.contains(USER));
        assert!(!debug.contains(TENANT));
        assert!(!debug.contains(token.token.expose()));
    }
    assert_eq!(token.root_block_id().len(), 64);
}

#[test]
fn cache_ttl_and_input_bounds_are_enforced() {
    // biscuit-auth 5.0 exposes only Ed25519 key material in this minimal
    // dependency closure; algorithm confusion has no public constructor.
    assert_eq!(
        RevocationChecker::new(MemoryRevocations::default(), Duration::from_secs(31))
            .err()
            .unwrap()
            .code,
        "auth.biscuit_invalid"
    );
    assert_eq!(
        SensitiveToken::from_transport("x".repeat(16_385))
            .unwrap_err()
            .code,
        "auth.biscuit_invalid"
    );
    assert_eq!(
        SensitiveToken::from_transport(String::new())
            .unwrap_err()
            .code,
        "auth.biscuit_invalid"
    );
    assert_eq!(
        BiscuitIssuer::new(39, KeyPair::new(), Duration::from_secs(901), UNIX_EPOCH,)
            .err()
            .unwrap()
            .code,
        "auth.biscuit_invalid"
    );

    let now = at(700);
    let mut revocations = checker();
    assert_eq!(
        revocations
            .check(&"a".repeat(16_385), now)
            .unwrap_err()
            .code,
        "auth.biscuit_invalid"
    );

    // Positive-only cache: a not-revoked verdict is never cached, so every
    // check re-consults the store within the same TTL window (no negative
    // cache to serve a stale accept). A store that starts failing after the
    // first check therefore makes the very next check fail closed.
    let root_block_id = "b".repeat(64);
    let mut positive_only = RevocationChecker::new(
        MemoryRevocations {
            fail_after_checks: Some(1),
            ..MemoryRevocations::default()
        },
        Duration::from_secs(30),
    )
    .unwrap();
    positive_only.check(&root_block_id, now).unwrap();
    for consult_now in [
        now,
        now + Duration::from_secs(1),
        now + Duration::from_secs(30),
    ] {
        assert_eq!(
            positive_only
                .check(&root_block_id, consult_now)
                .unwrap_err()
                .code,
            "auth.biscuit_invalid"
        );
    }

    let (issuer, ring) = issuer_and_ring(40, now);
    let bounded_target = issue(&issuer, now, "requester", &["read"], 900)
        .serialize()
        .unwrap();
    for invalid_now in [now - Duration::from_secs(1), now + Duration::from_secs(901)] {
        assert_eq!(
            revocations
                .revoke(
                    bounded_target.revocation_target(),
                    "test.invalid-retention".to_owned(),
                    invalid_now,
                )
                .unwrap_err()
                .code,
            "auth.biscuit_invalid"
        );
    }
    let mut exact_retention = checker();
    exact_retention
        .revoke(
            bounded_target.revocation_target(),
            "test.exact-retention".to_owned(),
            now,
        )
        .unwrap();
    assert!(
        exact_retention
            .into_store()
            .revoked
            .contains(bounded_target.root_block_id())
    );
    assert_eq!(
        issuer
            .issue(
                IssuanceRequest {
                    user_id: USER.to_owned(),
                    tenant_id: TENANT.to_owned(),
                    role: "requester".to_owned(),
                    resource: RESOURCE.to_owned(),
                    operations: operations(&["read"]),
                    ttl: Duration::from_secs(901),
                },
                now,
            )
            .unwrap_err()
            .code,
        "auth.biscuit_invalid"
    );
    assert_eq!(
        issuer
            .issue(
                IssuanceRequest {
                    user_id: USER.to_owned(),
                    tenant_id: "public".to_owned(),
                    role: "requester".to_owned(),
                    resource: RESOURCE.to_owned(),
                    operations: operations(&["read"]),
                    ttl: Duration::from_secs(60),
                },
                now,
            )
            .unwrap_err()
            .code,
        "auth.biscuit_invalid"
    );

    assert_eq!(
        issuer
            .issue(
                IssuanceRequest {
                    user_id: USER.to_owned(),
                    tenant_id: TENANT.to_owned(),
                    role: "requester".to_owned(),
                    resource: "mission/INVALID".to_owned(),
                    operations: operations(&["read"]),
                    ttl: Duration::from_secs(60),
                },
                now,
            )
            .unwrap_err()
            .code,
        "auth.biscuit_invalid"
    );

    let (unknown_issuer, _) = issuer_and_ring(41, now);
    let unknown_key_token = issue(&unknown_issuer, now, "requester", &["read"], 60)
        .serialize()
        .unwrap();
    assert_eq!(
        authorize(
            &unknown_key_token.token,
            mission_context(now + Duration::from_secs(1), "read"),
            &ring,
            &mut checker(),
        )
        .unwrap_err()
        .code,
        "auth.key_unavailable"
    );

    let valid = issue(&issuer, now, "requester", &["read"], 60)
        .serialize()
        .unwrap();
    let mut tampered = valid.token.expose().as_bytes().to_vec();
    let middle = tampered.len() / 2;
    tampered[middle] = if tampered[middle] == b'A' { b'B' } else { b'A' };
    let tampered = SensitiveToken::from_transport(String::from_utf8(tampered).unwrap()).unwrap();
    assert_eq!(
        authorize(
            &tampered,
            mission_context(now + Duration::from_secs(1), "read"),
            &ring,
            &mut checker(),
        )
        .unwrap_err()
        .code,
        "auth.biscuit_invalid"
    );
}

// --- Print/parse injectivity guard: adversarial regressions (finding A) ------

fn authority_only(kp: &KeyPair, key_id: u32, expiry: SystemTime, role: &str) -> Biscuit {
    let mut params = HashMap::<String, Term>::new();
    params.insert("user".to_owned(), string(USER));
    params.insert("tenant".to_owned(), string(TENANT));
    params.insert("role".to_owned(), string(role));
    params.insert("expires_at".to_owned(), Term::from(expiry));
    let mut builder = Biscuit::builder();
    builder.set_root_key_id(key_id);
    builder
        .add_code_with_params(AUTHORITY_TEMPLATE, params, HashMap::new())
        .unwrap();
    builder.build(kp).unwrap()
}

fn ring_for(
    key_id: u32,
    public_key: biscuit_auth::PublicKey,
    now: SystemTime,
) -> VerificationKeyRing {
    VerificationKeyRing::new(VerificationKey {
        key_id,
        public_key,
        valid_from: now - Duration::from_secs(1),
        valid_until: None,
        status: VerificationKeyStatus::Current,
    })
    .unwrap()
}

#[test]
fn print_parse_string_injection_channels_fail_closed() {
    // A holder of the root key forges block 1 as a single real check
    // `check if resource(<payload>)` whose Term::Str embeds quotes, backslashes,
    // comments, semicolons and a closing-string sequence. Unescaped printing
    // would let the reprinted source reparse to a canonical 4-check shape, but
    // the round-trip guard rejects the decoded poisoned string first.
    let now = at(800);
    let expiry = now + Duration::from_secs(300);
    let kp = KeyPair::new();
    let ring = ring_for(60, kp.public(), now);
    for payload in [
        format!("{RESOURCE}\"); check if operation($o), [\"read\"].contains($o); //"),
        format!("{RESOURCE}\\evil"),
        format!("{RESOURCE}\"); check if tenant(\"{TENANT}\"); //"),
    ] {
        let mut params = HashMap::<String, Term>::new();
        params.insert("p".to_owned(), Term::Str(payload));
        let mut block = BlockBuilder::new();
        block
            .add_code_with_params("check if resource({p});", params, HashMap::new())
            .unwrap();
        let forged = authority_only(&kp, 60, expiry, "requester")
            .append(block)
            .unwrap();
        let token = SensitiveToken::from_transport(forged.to_base64().unwrap()).unwrap();
        assert_eq!(
            authorize(
                &token,
                mission_context(now + Duration::from_secs(1), "read"),
                &ring,
                &mut checker(),
            )
            .unwrap_err()
            .code,
            "auth.biscuit_invalid"
        );
    }
}

#[test]
fn print_parse_variable_name_injection_fails_closed() {
    use biscuit_auth::builder::{Check, CheckKind, Predicate, Rule};
    // The confirmed exploit: a WEAK binary operation check `check if operation($X)`
    // whose variable NAME injects `, ["read"].contains($op)` so the reprinted
    // source reparses to a canonical set-restricted op check. Without the guard,
    // authorize() accepted "export" (outside the claimed ["read"]). The guard
    // now rejects the non-identifier variable name before any structural trust.
    let now = at(810);
    let expiry = now + Duration::from_secs(300);
    let kp = KeyPair::new();
    let ring = ring_for(61, kp.public(), now);
    let op_check = Check {
        queries: vec![Rule {
            head: Predicate {
                name: "query".to_owned(),
                terms: vec![],
            },
            body: vec![Predicate {
                name: "operation".to_owned(),
                terms: vec![Term::Variable("op), [\"read\"].contains($op".to_owned())],
            }],
            expressions: vec![],
            parameters: None,
            scopes: vec![],
            scope_parameters: None,
        }],
        kind: CheckKind::One,
    };
    let mut block = BlockBuilder::new();
    let mut resource_param = HashMap::<String, Term>::new();
    resource_param.insert("resource".to_owned(), string(RESOURCE));
    block
        .add_code_with_params(
            "check if resource({resource});",
            resource_param,
            HashMap::new(),
        )
        .unwrap();
    block.add_check(op_check).unwrap();
    let mut tail = HashMap::<String, Term>::new();
    tail.insert("tenant".to_owned(), string(TENANT));
    tail.insert("expires_at".to_owned(), Term::from(expiry));
    block
        .add_code_with_params(
            "check if tenant({tenant});\ncheck if time($time), $time < {expires_at};",
            tail,
            HashMap::new(),
        )
        .unwrap();
    let forged = authority_only(&kp, 61, expiry, "requester")
        .append(block)
        .unwrap();
    let token = SensitiveToken::from_transport(forged.to_base64().unwrap()).unwrap();
    assert_eq!(
        authorize(
            &token,
            mission_context(now + Duration::from_secs(1), "export"),
            &ring,
            &mut checker(),
        )
        .unwrap_err()
        .code,
        "auth.biscuit_invalid"
    );
}

#[test]
fn resources_with_slashes_still_authorize() {
    // The guard rejects only the round-trip-unsafe bytes " and \. A resource
    // carrying '/', '//', ':', '.', '-', '_' round-trips faithfully and is
    // accepted, so the guard does not false-reject legitimate resources.
    let now = at(820);
    let (issuer, ring) = issuer_and_ring(62, now);
    let resource = "mission:a//b.c-d_e";
    let token = issuer
        .issue(
            IssuanceRequest {
                user_id: USER.to_owned(),
                tenant_id: TENANT.to_owned(),
                role: "requester".to_owned(),
                resource: resource.to_owned(),
                operations: operations(&["read"]),
                ttl: Duration::from_secs(300),
            },
            now,
        )
        .unwrap()
        .serialize()
        .unwrap();
    let mut context = mission_context(now + Duration::from_secs(1), "read");
    context.resource = resource.to_owned();
    authorize(&token.token, context, &ring, &mut checker()).unwrap();
}

// --- Cross-instance revocation is immediate (finding B) ----------------------

#[derive(Clone, Default)]
struct SharedRevocations {
    inner: std::sync::Arc<std::sync::Mutex<BTreeSet<String>>>,
}

impl RevocationStore for SharedRevocations {
    fn is_revoked(&mut self, root_block_id: &str) -> Result<bool, RevocationStoreUnavailable> {
        Ok(self.inner.lock().unwrap().contains(root_block_id))
    }
    fn revoke(&mut self, record: RevocationRecord) -> Result<(), RevocationStoreUnavailable> {
        self.inner
            .lock()
            .unwrap()
            .insert(record.root_block_id().to_owned());
        Ok(())
    }
}

#[test]
fn cross_instance_revocation_is_immediate_within_cache_ttl() {
    let now = at(830);
    let (issuer, ring) = issuer_and_ring(63, now);
    let token = issue(&issuer, now, "requester", &["read"], 300)
        .serialize()
        .unwrap();
    let shared = SharedRevocations::default();
    let mut checker_a = RevocationChecker::new(shared.clone(), Duration::from_secs(30)).unwrap();
    let mut checker_b = RevocationChecker::new(shared.clone(), Duration::from_secs(30)).unwrap();

    // Verifier A accepts once. With a negative cache this would poison A for up
    // to 30 s; the positive-only cache leaves nothing to serve stale.
    let decision = authorize(
        &token.token,
        mission_context(now + Duration::from_secs(1), "read"),
        &ring,
        &mut checker_a,
    )
    .unwrap();

    // Verifier B performs the emergency revocation on the shared store.
    checker_b
        .revoke(
            decision.revocation_target(),
            "emergency.logout".to_owned(),
            now + Duration::from_secs(2),
        )
        .unwrap();

    // Verifier A must fail closed immediately, well inside the cache TTL.
    assert_eq!(
        authorize(
            &token.token,
            mission_context(now + Duration::from_secs(3), "read"),
            &ring,
            &mut checker_a,
        )
        .unwrap_err()
        .code,
        "auth.biscuit_revoked"
    );
}

// --- Whole-second TTL enforcement (finding C) --------------------------------

#[test]
fn subsecond_and_fractional_ttls_are_rejected_whole_seconds_accepted() {
    let now = at(850);
    let (issuer, ring) = issuer_and_ring(64, now);
    for bad in [
        Duration::ZERO,
        Duration::from_millis(50),
        Duration::from_millis(200),
        Duration::from_millis(1_500),
    ] {
        assert_eq!(
            issuer
                .issue(
                    IssuanceRequest {
                        user_id: USER.to_owned(),
                        tenant_id: TENANT.to_owned(),
                        role: "requester".to_owned(),
                        resource: RESOURCE.to_owned(),
                        operations: operations(&["read"]),
                        ttl: bad,
                    },
                    now,
                )
                .unwrap_err()
                .code,
            "auth.biscuit_invalid"
        );
    }

    // A whole-second TTL issued at a fractional real-clock `now` is accepted and
    // authorizes at issue time (no born-invalid truncation).
    let fractional_now = now + Duration::from_millis(900);
    let token = issuer
        .issue(
            IssuanceRequest {
                user_id: USER.to_owned(),
                tenant_id: TENANT.to_owned(),
                role: "requester".to_owned(),
                resource: RESOURCE.to_owned(),
                operations: operations(&["read"]),
                ttl: Duration::from_secs(1),
            },
            fractional_now,
        )
        .unwrap()
        .serialize()
        .unwrap();
    authorize(
        &token.token,
        mission_context(fractional_now, "read"),
        &ring,
        &mut checker(),
    )
    .unwrap();
}

// --- Transactional finish_rotation (finding D) -------------------------------

#[test]
fn finish_rotation_preserves_ring_on_error() {
    let now = at(860);
    let current = KeyPair::new();
    let mut ring = VerificationKeyRing::new(VerificationKey {
        key_id: 1,
        public_key: current.public(),
        valid_from: now - Duration::from_secs(1),
        valid_until: None,
        status: VerificationKeyStatus::Current,
    })
    .unwrap();
    let next = KeyPair::new();
    ring.begin_rotation(
        VerificationKey {
            key_id: 2,
            public_key: next.public(),
            valid_from: now + Duration::from_secs(10),
            valid_until: None,
            status: VerificationKeyStatus::Current,
        },
        now + Duration::from_secs(920),
        now,
    )
    .unwrap();

    // Revoke the new Current, leaving one Retiring key, then advance past its
    // validity. finish_rotation must Err WITHOUT emptying the ring.
    ring.revoke_key(2);
    assert_eq!(ring.public_keys().len(), 1);
    assert_eq!(
        ring.finish_rotation(now + Duration::from_secs(921))
            .unwrap_err()
            .code,
        "auth.key_unavailable"
    );
    assert_eq!(
        ring.public_keys().len(),
        1,
        "the ring must be preserved on a rejected finish_rotation"
    );
    assert_eq!(
        ring.public_keys()[0].status,
        VerificationKeyStatus::Retiring
    );
}

// Part b1: the issuer mints agent-fleet tokens carrying the K1 identity facts,
// and the agent-runs-v2 authorizer enforces the fleet boundary end-to-end.
#[test]
fn agent_token_carries_k1_facts_and_agent_runs_v2_denies_cross_fleet() {
    use biscuit_auth::builder::{date, fact, string};
    use biscuit_auth::datalog::RunLimits;

    let now = at(0);
    let (issuer, _ring) = issuer_and_ring(1, now);
    let public_key = issuer.public_key();
    let serialized = issuer
        .issue_agent(
            IssuanceRequest {
                user_id: USER.to_owned(),
                tenant_id: TENANT.to_owned(),
                role: "author-agent".to_owned(),
                resource: RESOURCE.to_owned(),
                operations: operations(&["submit-plan"]),
                ttl: Duration::from_secs(300),
            },
            libre_ai_authz_biscuit::AgentIdentity {
                fleet: "forge".to_owned(),
                mission: "mission-alpha".to_owned(),
                capability: "invoke-planned-tool".to_owned(),
            },
            now,
        )
        .unwrap()
        .serialize()
        .unwrap();
    let policy = std::fs::read_to_string(
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../contracts/authz/agent-runs-v2.datalog"),
    )
    .unwrap();

    let authorizes = |resource_fleet: &str| -> bool {
        let biscuit = Biscuit::from_base64(serialized.token.expose(), public_key).unwrap();
        let mut authorizer = biscuit.authorizer().unwrap();
        for injected in [
            fact("time", &[date(&(now + Duration::from_secs(1)))]),
            fact("resource", &[string(RESOURCE)]),
            fact("operation", &[string("submit-plan")]),
            fact("resource_tenant", &[string(TENANT)]),
            fact("resource_fleet", &[string(resource_fleet)]),
            fact("resource_mission", &[string("mission-alpha")]),
            fact("subject_type", &[string("execution-plan")]),
        ] {
            authorizer.add_fact(injected).unwrap();
        }
        authorizer.add_code(policy.as_str()).unwrap();
        authorizer
            .authorize_with_limits(RunLimits {
                max_facts: 256,
                max_iterations: 32,
                max_time: Duration::from_millis(50),
            })
            .is_ok()
    };

    assert!(
        authorizes("forge"),
        "an agent token whose fleet matches the resource must authorize"
    );
    assert!(
        !authorizes("product-ops"),
        "a cross-fleet agent token must be denied by agent-runs-v2"
    );
}
