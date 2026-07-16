use crate::AuthzError;
use crate::keys::VerificationKeyRing;
use crate::revocation::{RevocationChecker, RevocationStore};
use crate::token::{
    SensitiveToken, root_block_id, valid_operation, valid_prefixed_id, valid_resource,
};
use biscuit_auth::builder::{AuthorizerBuilder, date, fact, string};
use biscuit_auth::{AuthorizerLimits, Biscuit, UnverifiedBiscuit};
use biscuit_parser::builder::{Binary, CheckKind, Op, Term};
use biscuit_parser::parser::parse_source;
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
    revocations.check(&root_block_id, context.now)?;
    let (principal, expires_at) = authority_principal(&token, &root_block_id)?;
    let remaining = expires_at
        .duration_since(context.now)
        .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?;
    if remaining.is_zero() || remaining > Duration::from_secs(900) {
        return Err(AuthzError::for_root(
            "auth.operation_denied",
            &root_block_id,
        ));
    }

    let mut builder = AuthorizerBuilder::new()
        .fact(fact("time", &[date(&context.now)]))
        .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?
        .fact(fact("resource", &[string(&context.resource)]))
        .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?
        .fact(fact("operation", &[string(&context.operation)]))
        .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?
        .fact(fact("request_tenant", &[string(&context.request_tenant)]))
        .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?
        .fact(fact("resource_tenant", &[string(&context.resource_tenant)]))
        .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?;
    if let Some(audience) = &context.audience {
        builder = builder
            .fact(fact("audience", &[string(audience)]))
            .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?;
    }
    if let Some(owner) = &context.contribution_owner_user_id {
        builder = builder
            .fact(fact("contribution_owner", &[string(owner)]))
            .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?;
    }
    let mut authorizer = builder
        .code(context.policy.source())
        .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?
        .set_limits(AuthorizerLimits {
            max_facts: 1_000,
            max_iterations: 100,
            max_time: Duration::from_millis(5),
        })
        .build(&token)
        .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?;
    let matched_policy = authorizer
        .authorize()
        .map_err(|_| AuthzError::for_root("auth.operation_denied", &root_block_id))?;
    Ok(AuthorizationDecision {
        principal,
        root_block_id,
        matched_policy,
    })
}

fn authority_principal(
    token: &Biscuit,
    root_block_id: &str,
) -> Result<(VerifiedPrincipal, SystemTime), AuthzError> {
    let denied = || AuthzError::for_root("auth.operation_denied", root_block_id);
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

    let check = &parsed.checks[0].1;
    if check.kind != CheckKind::One || check.queries.len() != 1 {
        return Err(denied());
    }
    let query = &check.queries[0];
    if query.head.name != "query"
        || !query.head.terms.is_empty()
        || !query.scopes.is_empty()
        || query.body.len() != 1
        || query.expressions.len() != 1
    {
        return Err(denied());
    }
    let time_variable = match (query.body[0].name.as_str(), query.body[0].terms.as_slice()) {
        ("time", [Term::Variable(variable)]) => variable,
        _ => return Err(denied()),
    };
    let expires_at = match query.expressions[0].ops.as_slice() {
        [
            Op::Value(Term::Variable(variable)),
            Op::Value(Term::Date(expires_at)),
            Op::Binary(Binary::LessThan),
        ] if variable == time_variable => UNIX_EPOCH
            .checked_add(Duration::from_secs(*expires_at))
            .ok_or_else(denied)?,
        _ => return Err(denied()),
    };
    Ok((
        VerifiedPrincipal {
            user_id,
            tenant_id,
            role,
        },
        expires_at,
    ))
}

fn validate_context(context: &AuthorizationContext) -> Result<(), AuthzError> {
    if context.now.duration_since(UNIX_EPOCH).is_err()
        || context.request_tenant != context.resource_tenant
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
