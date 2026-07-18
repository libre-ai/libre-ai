use biscuit_auth::builder::{BlockBuilder, date, fact, string};
use biscuit_auth::{Biscuit, KeyPair};
use libre_ai_authz_biscuit::{
    AttenuationRequest, AuthorizationContext, BiscuitIssuer, CanonicalPolicy, IssuanceRequest,
    RevocationChecker, RevocationRecord, RevocationStore, RevocationStoreUnavailable,
    SensitiveToken, VerificationKey, VerificationKeyRing, VerificationKeyStatus, authorize,
};
use std::collections::BTreeSet;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const USER: &str = "usr_0123456789abcdef";
const OTHER_USER: &str = "usr_fedcba9876543210";
const TENANT: &str = "ten_0123456789abcdef";
const OTHER_TENANT: &str = "ten_fedcba9876543210";
const RESOURCE: &str = "mission:0123456789abcdef";

#[derive(Default)]
struct MemoryRevocations {
    revoked: BTreeSet<String>,
    unavailable: bool,
}

impl RevocationStore for MemoryRevocations {
    fn is_revoked(&mut self, root_block_id: &str) -> Result<bool, RevocationStoreUnavailable> {
        if self.unavailable {
            return Err(RevocationStoreUnavailable);
        }
        Ok(self.revoked.contains(root_block_id))
    }

    fn revoke(&mut self, record: RevocationRecord) -> Result<(), RevocationStoreUnavailable> {
        if self.unavailable {
            return Err(RevocationStoreUnavailable);
        }
        self.revoked.insert(record.root_block_id);
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
    let issuer = BiscuitIssuer::new(key_id, key_pair, Duration::from_secs(900)).unwrap();
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
    assert_eq!(decision.root_block_id, token.root_block_id);

    let error = authorize(
        &token.token,
        mission_context(now + Duration::from_secs(2), "delete"),
        &ring,
        &mut revocations,
    )
    .unwrap_err();
    assert_eq!(error.code, "auth.operation_denied");
    assert_eq!(
        error.root_block_id.as_deref(),
        Some(token.root_block_id.as_str())
    );

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
fn offline_attenuation_can_only_reduce_authority() {
    let now = at(200);
    let (issuer, ring) = issuer_and_ring(3, now);
    let parent = issue(&issuer, now, "requester", &["read", "propose"], 300);
    let parent_root = parent.serialize().unwrap().root_block_id;
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
    assert_eq!(child.root_block_id, parent_root);
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
    authorize(
        &token.token,
        mission_context(now + Duration::from_secs(1), "read"),
        &ring,
        &mut revocations,
    )
    .unwrap();

    revocations
        .revoke(
            RevocationRecord {
                root_block_id: token.root_block_id.clone(),
                reason_code: "session.logout".to_owned(),
                revoked_at: now + Duration::from_secs(2),
                expires_at: token.expires_at,
            },
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
            )
            .unwrap_err()
            .code,
        "auth.key_unavailable"
    );

    let new_pair = KeyPair::new();
    let new_public = new_pair.public();
    let new_issuer = BiscuitIssuer::new(11, new_pair, Duration::from_secs(900)).unwrap();
    ring.begin_rotation(
        VerificationKey {
            key_id: 11,
            public_key: new_public,
            valid_from: now + Duration::from_secs(10),
            valid_until: None,
            status: VerificationKeyStatus::Current,
        },
        now + Duration::from_secs(920),
    )
    .unwrap();
    assert_eq!(ring.public_keys().len(), 2);

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
    assert_eq!(token.root_block_id.len(), 64);
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
        BiscuitIssuer::new(39, KeyPair::new(), Duration::from_secs(901))
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
    assert_eq!(
        revocations
            .revoke(
                RevocationRecord {
                    root_block_id: "a".repeat(64),
                    reason_code: "test.invalid-retention".to_owned(),
                    revoked_at: now,
                    expires_at: now + Duration::from_secs(901),
                },
                now,
            )
            .unwrap_err()
            .code,
        "auth.biscuit_invalid"
    );
    assert_eq!(
        revocations
            .revoke(
                RevocationRecord {
                    root_block_id: "a".repeat(64),
                    reason_code: "test.expired-record".to_owned(),
                    revoked_at: now - Duration::from_secs(60),
                    expires_at: now - Duration::from_secs(1),
                },
                now,
            )
            .unwrap_err()
            .code,
        "auth.biscuit_invalid"
    );

    let (issuer, ring) = issuer_and_ring(40, now);
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
