use crate::AuthzError;
use crate::keys::VerificationKeyRing;
use crate::revocation::{RevocationChecker, RevocationStore, RevocationTarget};
use crate::token::{
    SensitiveToken, root_block_id, valid_operation, valid_prefixed_id, valid_resource,
};
use biscuit_auth::builder::{date, fact, string};
use biscuit_auth::{Authorizer, AuthorizerLimits, Biscuit, UnverifiedBiscuit};
use biscuit_parser_legacy::builder::{Binary, Check, CheckKind, Op, Rule, Term};
use biscuit_parser_legacy::parser::parse_source;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const SESSIONS_POLICY: &str = include_str!("../../../contracts/authz/sessions-v1.datalog");
const MISSIONS_POLICY: &str = include_str!("../../../contracts/authz/missions-v1.datalog");
const MAX_TOKEN_SIZE: usize = 16_384;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CanonicalPolicy {
    Sessions,
    Missions,
}

impl CanonicalPolicy {
    fn source(self) -> &'static str {
        match self {
            Self::Sessions => SESSIONS_POLICY,
            Self::Missions => MISSIONS_POLICY,
        }
    }
}

#[derive(Clone)]
pub struct AuthorizationContext {
    pub policy: CanonicalPolicy,
    pub resource: String,
    pub operation: String,
    pub request_tenant: String,
    pub resource_tenant: String,
    pub audience: Option<String>,
    pub contribution_owner_user_id: Option<String>,
    pub now: SystemTime,
}

#[derive(Clone, Eq, PartialEq)]
pub struct VerifiedPrincipal {
    pub user_id: String,
    pub tenant_id: String,
    pub role: String,
}

#[derive(Clone, Eq, PartialEq)]
pub struct AuthorizationDecision {
    pub principal: VerifiedPrincipal,
    pub root_block_id: String,
    pub matched_policy: usize,
    revocation_target: RevocationTarget,
}

impl AuthorizationDecision {
    #[must_use]
    pub fn revocation_target(&self) -> &RevocationTarget {
        &self.revocation_target
    }
}

impl std::fmt::Debug for AuthorizationDecision {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("AuthorizationDecision")
            .field("principal", &"[REDACTED]")
            .field("root_block_id", &self.root_block_id)
            .field("matched_policy", &self.matched_policy)
            .finish()
    }
}

pub fn authorize<S: RevocationStore>(
    serialized: &SensitiveToken,
    context: AuthorizationContext,
    keys: &VerificationKeyRing,
    revocations: &mut RevocationChecker<S>,
) -> Result<AuthorizationDecision, AuthzError> {
    validate_context(&context)?;
    if serialized.expose().len() > MAX_TOKEN_SIZE {
        return Err(AuthzError::new("auth.biscuit_invalid"));
    }
    let unverified = UnverifiedBiscuit::from_base64(serialized.expose())
        .map_err(|_| AuthzError::new("auth.biscuit_invalid"))?;
    let key_id = unverified
        .root_key_id()
        .ok_or_else(|| AuthzError::new("auth.key_unavailable"))?;
    let public_key = keys.select(key_id, context.now)?;
    let token = Biscuit::from_base64(serialized.expose(), public_key)
        .map_err(|_| AuthzError::new("auth.biscuit_invalid"))?;
    let root_block_id = root_block_id(&token)?;
    let mut authorizer = token
        .authorizer()
        .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?;
    // The structural validation below trusts the printed Datalog source of
    // blocks 0 and 1. biscuit-auth 5.0's printer emits `Term::Str`, variable
    // names and predicate names without escaping, so a holder of the root key
    // could otherwise sign a block whose reprinted source reparses to a
    // canonical shape while the binary the authorizer actually evaluates is
    // weaker (e.g. an unbounded `operation($x)` printed as a set-restricted
    // check). Reject any decoded term that would not survive the pinned
    // print/parse grammar unchanged, restoring the injectivity the validators
    // rely on. See SECURITY.md and evidence/reviews/fbbe360/.
    if !blocks_roundtrip_safe(&authorizer) {
        return Err(AuthzError::for_root("auth.biscuit_invalid", &root_block_id));
    }
    revocations.check(&root_block_id, context.now)?;
    let (principal, expires_at) = authority_principal(&token, &root_block_id)?;
    validate_initial_attenuation(&token, &principal, expires_at, &root_block_id)?;
    if principal.tenant_id != context.request_tenant {
        return Err(AuthzError::for_root("auth.tenant_mismatch", &root_block_id));
    }
    let remaining = expires_at
        .duration_since(context.now)
        .map_err(|_| AuthzError::for_root("auth.biscuit_invalid", &root_block_id))?;
    if remaining.is_zero() || remaining > Duration::from_secs(900) {
        return Err(AuthzError::for_root("auth.biscuit_invalid", &root_block_id));
    }

    for ambient_fact in [
        fact("time", &[date(&context.now)]),
        fact("resource", &[string(&context.resource)]),
        fact("operation", &[string(&context.operation)]),
        fact("request_tenant", &[string(&context.request_tenant)]),
        fact("resource_tenant", &[string(&context.resource_tenant)]),
    ] {
        authorizer
            .add_fact(ambient_fact)
            .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?;
    }
    if let Some(audience) = &context.audience {
        authorizer
            .add_fact(fact("audience", &[string(audience)]))
            .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?;
    }
    if let Some(owner) = &context.contribution_owner_user_id {
        authorizer
            .add_fact(fact("contribution_owner", &[string(owner)]))
            .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?;
    }
    authorizer
        .add_code(context.policy.source())
        .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?;
    let matched_policy = authorizer
        .authorize_with_limits(AuthorizerLimits {
            max_facts: 256,
            max_iterations: 32,
            max_time: Duration::from_millis(50),
        })
        .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?;
    let revocation_target = RevocationTarget::new(root_block_id.clone(), expires_at);
    Ok(AuthorizationDecision {
        principal,
        root_block_id,
        matched_policy,
        revocation_target,
    })
}

fn authority_principal(
    token: &Biscuit,
    root_block_id: &str,
) -> Result<(VerifiedPrincipal, SystemTime), AuthzError> {
    let denied = || AuthzError::for_root("auth.biscuit_invalid", root_block_id);
    if !matches!(token.context().first(), Some(None)) {
        return Err(denied());
    }
    let source = token.print_block_source(0).map_err(|_| denied())?;
    let parsed = parse_source(&source).map_err(|_| denied())?;
    if !parsed.scopes.is_empty()
        || !parsed.rules.is_empty()
        || !parsed.policies.is_empty()
        || parsed.facts.len() != 3
        || parsed.checks.len() != 1
    {
        return Err(denied());
    }

    let mut user_id = None;
    let mut tenant_id = None;
    let mut role = None;
    for (_, fact) in &parsed.facts {
        match (
            fact.predicate.name.as_str(),
            fact.predicate.terms.as_slice(),
        ) {
            ("user", [Term::Str(value)]) if user_id.is_none() => user_id = Some(value.clone()),
            ("tenant", [Term::Str(value)]) if tenant_id.is_none() => {
                tenant_id = Some(value.clone());
            }
            ("role", [Term::Str(user), Term::Str(value)]) if role.is_none() => {
                role = Some((user.clone(), value.clone()));
            }
            _ => return Err(denied()),
        }
    }
    let user_id = user_id.ok_or_else(denied)?;
    let tenant_id = tenant_id.ok_or_else(denied)?;
    let (role_user, role) = role.ok_or_else(denied)?;
    if role_user != user_id
        || !valid_prefixed_id(&user_id, "usr_")
        || !valid_prefixed_id(&tenant_id, "ten_")
        || !valid_operation(&role)
    {
        return Err(denied());
    }

    let expires_at = exact_expiration_check(&parsed.checks[0].1).ok_or_else(denied)?;
    Ok((
        VerifiedPrincipal {
            user_id,
            tenant_id,
            role,
        },
        expires_at,
    ))
}

fn validate_initial_attenuation(
    token: &Biscuit,
    principal: &VerifiedPrincipal,
    authority_expires_at: SystemTime,
    root_block_id: &str,
) -> Result<(), AuthzError> {
    let invalid = || AuthzError::for_root("auth.biscuit_invalid", root_block_id);
    if token.block_count() < 2 || !matches!(token.context().get(1), Some(None)) {
        return Err(invalid());
    }
    let source = token.print_block_source(1).map_err(|_| invalid())?;
    let parsed = parse_source(&source).map_err(|_| invalid())?;
    if !parsed.scopes.is_empty()
        || !parsed.facts.is_empty()
        || !parsed.rules.is_empty()
        || !parsed.policies.is_empty()
        || parsed.checks.len() != 4
    {
        return Err(invalid());
    }

    let resource = exact_string_check(&parsed.checks[0].1, "resource").ok_or_else(invalid)?;
    let tenant = exact_string_check(&parsed.checks[2].1, "tenant").ok_or_else(invalid)?;
    let expires_at = exact_expiration_check(&parsed.checks[3].1).ok_or_else(invalid)?;
    if !valid_resource(resource)
        || !canonical_operation_check(&parsed.checks[1].1)
        || tenant != principal.tenant_id
        || expires_at != authority_expires_at
    {
        return Err(invalid());
    }
    Ok(())
}

fn canonical_query(check: &Check) -> Option<&Rule> {
    if check.kind != CheckKind::One || check.queries.len() != 1 {
        return None;
    }
    let query = &check.queries[0];
    if query.head.name != "query" || !query.head.terms.is_empty() || !query.scopes.is_empty() {
        return None;
    }
    Some(query)
}

fn exact_string_check<'a>(check: &'a Check, predicate: &str) -> Option<&'a str> {
    let query = canonical_query(check)?;
    if !query.expressions.is_empty() || query.body.len() != 1 {
        return None;
    }
    match (query.body[0].name.as_str(), query.body[0].terms.as_slice()) {
        (name, [Term::Str(value)]) if name == predicate => Some(value),
        _ => None,
    }
}

fn canonical_operation_check(check: &Check) -> bool {
    let Some(query) = canonical_query(check) else {
        return false;
    };
    if query.body.len() != 1 || query.expressions.len() != 1 {
        return false;
    }
    let operation_variable = match (query.body[0].name.as_str(), query.body[0].terms.as_slice()) {
        ("operation", [Term::Variable(variable)]) => variable,
        _ => return false,
    };
    match query.expressions[0].ops.as_slice() {
        [
            Op::Value(Term::Set(operations)),
            Op::Value(Term::Variable(variable)),
            Op::Binary(Binary::Contains),
        ] if variable == operation_variable => {
            !operations.is_empty()
                && operations.len() <= 20
                && operations.iter().all(
                    |operation| matches!(operation, Term::Str(value) if valid_operation(value)),
                )
        }
        _ => false,
    }
}

fn exact_expiration_check(check: &Check) -> Option<SystemTime> {
    let query = canonical_query(check)?;
    if query.body.len() != 1 || query.expressions.len() != 1 {
        return None;
    }
    let time_variable = match (query.body[0].name.as_str(), query.body[0].terms.as_slice()) {
        ("time", [Term::Variable(variable)]) => variable,
        _ => return None,
    };
    match query.expressions[0].ops.as_slice() {
        [
            Op::Value(Term::Variable(variable)),
            Op::Value(Term::Date(expires_at)),
            Op::Binary(Binary::LessThan),
        ] if variable == time_variable => UNIX_EPOCH.checked_add(Duration::from_secs(*expires_at)),
        _ => None,
    }
}

fn validate_context(context: &AuthorizationContext) -> Result<(), AuthzError> {
    if context.request_tenant != context.resource_tenant {
        return Err(AuthzError::new("auth.tenant_mismatch"));
    }
    if context.now.duration_since(UNIX_EPOCH).is_err()
        || !valid_prefixed_id(&context.request_tenant, "ten_")
        || !valid_resource(&context.resource)
        || !valid_operation(&context.operation)
        || context
            .audience
            .as_deref()
            .is_some_and(|audience| !valid_operation(audience))
        || context
            .contribution_owner_user_id
            .as_deref()
            .is_some_and(|user| !valid_prefixed_id(user, "usr_"))
    {
        return Err(AuthzError::new("auth.operation_denied"));
    }
    Ok(())
}

/// Reject any token whose decoded terms would not survive the pinned
/// print/parse round trip unchanged.
///
/// [`authority_principal`] and [`validate_initial_attenuation`] validate the
/// canonical shape of blocks 0 and 1 by reprinting them with biscuit-auth 5.0's
/// printer and reparsing with biscuit-parser 0.1.2. That printer emits string
/// values (`"{}"`), variable names (`${}`) and predicate names verbatim, with
/// no escaping, while the parser terminates a string at the first raw `"`,
/// treats `\` as an escape introducer and stops an identifier at the first
/// non-identifier byte. A term carrying one of those bytes therefore reparses
/// into a *different* structure than the binary the authorizer evaluates. This
/// guard removes that entire differential class up front: if every decoded
/// `Term::Str` is free of `"`/`\` and every emitted identifier is a plain
/// datalog identifier, the printed source is a faithful (injective) rendering
/// of the binary and the structural validators can be trusted.
fn blocks_roundtrip_safe(authorizer: &Authorizer) -> bool {
    use biscuit_auth::builder::{Op, Predicate, Rule, Term};

    fn safe_string(value: &str) -> bool {
        !value.bytes().any(|byte| byte == b'"' || byte == b'\\')
    }
    fn safe_identifier(value: &str) -> bool {
        !value.is_empty()
            && value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b':')
    }
    fn term_ok(term: &Term) -> bool {
        match term {
            Term::Str(value) => safe_string(value),
            Term::Variable(name) => safe_identifier(name),
            Term::Set(members) => members.iter().all(term_ok),
            _ => true,
        }
    }
    fn predicate_ok(predicate: &Predicate) -> bool {
        safe_identifier(&predicate.name) && predicate.terms.iter().all(term_ok)
    }
    fn rule_ok(rule: &Rule) -> bool {
        predicate_ok(&rule.head)
            && rule.body.iter().all(predicate_ok)
            && rule.expressions.iter().all(|expression| {
                expression.ops.iter().all(|op| match op {
                    Op::Value(term) => term_ok(term),
                    _ => true,
                })
            })
    }

    let (facts, rules, checks, policies) = authorizer.dump();
    facts.iter().all(|fact| predicate_ok(&fact.predicate))
        && rules.iter().all(rule_ok)
        && checks.iter().all(|check| check.queries.iter().all(rule_ok))
        && policies
            .iter()
            .all(|policy| policy.queries.iter().all(rule_ok))
}
