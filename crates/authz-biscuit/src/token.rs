use crate::{AuthzError, revocation::RevocationTarget};
use biscuit_auth::builder::{BlockBuilder, Term};
use biscuit_auth::{Biscuit, KeyPair, PublicKey};
use sha2::{Digest, Sha256};
use std::collections::{BTreeSet, HashMap};
use std::fmt::{self, Debug, Formatter};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use zeroize::Zeroize;

const AUTHORITY_TEMPLATE: &str = include_str!("../../../contracts/authz/authority-v1.datalog");
const MAX_TOKEN_SIZE: usize = 16_384;

pub struct SensitiveToken(String);

impl SensitiveToken {
    pub fn from_transport(mut value: String) -> Result<Self, AuthzError> {
        if value.is_empty() || value.len() > MAX_TOKEN_SIZE {
            value.zeroize();
            return Err(AuthzError::new("auth.biscuit_invalid"));
        }
        Ok(Self(value))
    }

    #[must_use]
    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl Drop for SensitiveToken {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

impl Debug for SensitiveToken {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str("SensitiveToken([REDACTED])")
    }
}

pub struct SerializedBiscuit {
    pub token: SensitiveToken,
    revocation_target: RevocationTarget,
    expires_at: SystemTime,
    key_id: u32,
}

impl SerializedBiscuit {
    #[must_use]
    pub fn token(&self) -> &SensitiveToken {
        &self.token
    }

    #[must_use]
    pub fn root_block_id(&self) -> &str {
        self.revocation_target.root_block_id()
    }

    #[must_use]
    pub fn key_id(&self) -> u32 {
        self.key_id
    }

    #[must_use]
    pub fn expires_at(&self) -> SystemTime {
        self.expires_at
    }

    #[must_use]
    pub fn revocation_target(&self) -> &RevocationTarget {
        &self.revocation_target
    }
}

impl Debug for SerializedBiscuit {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("SerializedBiscuit")
            .field("token", &"[REDACTED]")
            .field("root_block_id", &self.root_block_id())
            .field("key_id", &self.key_id)
            .field("expires_at", &self.expires_at())
            .finish()
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct TokenBounds {
    pub tenant_id: String,
    pub resource: String,
    pub operations: BTreeSet<String>,
    pub expires_at: SystemTime,
}

impl Debug for TokenBounds {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str("TokenBounds([REDACTED])")
    }
}

pub struct BoundedBiscuit {
    biscuit: Biscuit,
    bounds: TokenBounds,
    authority_expires_at: SystemTime,
    key_id: u32,
}

impl Debug for BoundedBiscuit {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str("BoundedBiscuit([REDACTED])")
    }
}

impl BoundedBiscuit {
    #[must_use]
    pub fn bounds(&self) -> &TokenBounds {
        &self.bounds
    }

    pub fn attenuate(
        &self,
        request: AttenuationRequest,
        now: SystemTime,
    ) -> Result<Self, AuthzError> {
        validate_bounds(&request.tenant_id, &request.resource, &request.operations)?;
        validate_time(now)?;
        if request.ttl.is_zero() {
            return Err(AuthzError::new("auth.biscuit_invalid"));
        }
        let expires_at = now
            .checked_add(request.ttl)
            .ok_or_else(|| AuthzError::new("auth.biscuit_invalid"))?;
        if now >= self.bounds.expires_at
            || request.tenant_id != self.bounds.tenant_id
            || request.resource != self.bounds.resource
            || !request.operations.is_subset(&self.bounds.operations)
            || expires_at > self.bounds.expires_at
        {
            return Err(AuthzError::new("auth.biscuit_invalid"));
        }
        let bounds = TokenBounds {
            tenant_id: request.tenant_id,
            resource: request.resource,
            operations: request.operations,
            expires_at,
        };
        let block = attenuation_block(&bounds)?;
        let biscuit = self
            .biscuit
            .append(block)
            .map_err(|_| AuthzError::new("auth.biscuit_invalid"))?;
        Ok(Self {
            biscuit,
            bounds,
            authority_expires_at: self.authority_expires_at,
            key_id: self.key_id,
        })
    }

    pub fn serialize(&self) -> Result<SerializedBiscuit, AuthzError> {
        let root_block_id = root_block_id(&self.biscuit)?;
        let expires_at = effective_expiration(self.bounds.expires_at)?;
        let authority_expires_at = effective_expiration(self.authority_expires_at)?;
        let mut token = self
            .biscuit
            .to_base64()
            .map_err(|_| AuthzError::new("auth.biscuit_invalid"))?;
        if token.len() > MAX_TOKEN_SIZE {
            token.zeroize();
            return Err(AuthzError::new("auth.biscuit_invalid"));
        }
        Ok(SerializedBiscuit {
            token: SensitiveToken(token),
            revocation_target: RevocationTarget::new(root_block_id, authority_expires_at),
            expires_at,
            key_id: self.key_id,
        })
    }
}

pub struct BiscuitIssuer {
    key_id: u32,
    key_pair: KeyPair,
    max_ttl: Duration,
    valid_from: SystemTime,
}

impl Debug for BiscuitIssuer {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("BiscuitIssuer")
            .field("key_id", &self.key_id)
            .field("key_pair", &"[REDACTED]")
            .field("max_ttl", &self.max_ttl)
            .field("valid_from", &self.valid_from)
            .finish()
    }
}

impl BiscuitIssuer {
    pub fn new(
        key_id: u32,
        key_pair: KeyPair,
        max_ttl: Duration,
        valid_from: SystemTime,
    ) -> Result<Self, AuthzError> {
        // biscuit-auth 5.0 exposes Ed25519 keys only; no alternate signing
        // algorithm enters this dependency closure.
        if max_ttl.is_zero()
            || max_ttl > Duration::from_secs(900)
            || valid_from.duration_since(UNIX_EPOCH).is_err()
        {
            return Err(AuthzError::new("auth.biscuit_invalid"));
        }
        Ok(Self {
            key_id,
            key_pair,
            max_ttl,
            valid_from,
        })
    }

    #[must_use]
    pub fn public_key(&self) -> PublicKey {
        self.key_pair.public()
    }

    #[must_use]
    pub fn key_id(&self) -> u32 {
        self.key_id
    }

    pub fn issue(
        &self,
        request: IssuanceRequest,
        now: SystemTime,
    ) -> Result<BoundedBiscuit, AuthzError> {
        validate_time(now)?;
        if now < self.valid_from {
            return Err(AuthzError::new("auth.key_unavailable"));
        }
        validate_identity(&request.user_id, &request.tenant_id, &request.role)?;
        validate_bounds(&request.tenant_id, &request.resource, &request.operations)?;
        if request.ttl.is_zero() || request.ttl > self.max_ttl {
            return Err(AuthzError::new("auth.biscuit_invalid"));
        }
        let expires_at = now
            .checked_add(request.ttl)
            .ok_or_else(|| AuthzError::new("auth.biscuit_invalid"))?;
        let mut parameters = HashMap::<String, Term>::new();
        parameters.insert("user".to_owned(), request.user_id.into());
        parameters.insert("tenant".to_owned(), request.tenant_id.clone().into());
        parameters.insert("role".to_owned(), request.role.into());
        parameters.insert("expires_at".to_owned(), expires_at.into());
        let mut builder = Biscuit::builder();
        builder.set_root_key_id(self.key_id);
        builder
            .add_code_with_params(AUTHORITY_TEMPLATE, parameters, HashMap::new())
            .map_err(|_| AuthzError::new("auth.biscuit_invalid"))?;
        let authority = builder
            .build(&self.key_pair)
            .map_err(|_| AuthzError::new("auth.biscuit_invalid"))?;
        let bounds = TokenBounds {
            tenant_id: request.tenant_id,
            resource: request.resource,
            operations: request.operations,
            expires_at,
        };
        let biscuit = authority
            .append(attenuation_block(&bounds)?)
            .map_err(|_| AuthzError::new("auth.biscuit_invalid"))?;
        Ok(BoundedBiscuit {
            biscuit,
            bounds,
            authority_expires_at: expires_at,
            key_id: self.key_id,
        })
    }
}

#[derive(Clone)]
pub struct IssuanceRequest {
    pub user_id: String,
    pub tenant_id: String,
    pub role: String,
    pub resource: String,
    pub operations: BTreeSet<String>,
    pub ttl: Duration,
}

#[derive(Clone)]
pub struct AttenuationRequest {
    pub tenant_id: String,
    pub resource: String,
    pub operations: BTreeSet<String>,
    pub ttl: Duration,
}

fn attenuation_block(bounds: &TokenBounds) -> Result<BlockBuilder, AuthzError> {
    let mut parameters = HashMap::<String, Term>::new();
    parameters.insert("resource".to_owned(), bounds.resource.clone().into());
    parameters.insert("tenant".to_owned(), bounds.tenant_id.clone().into());
    parameters.insert("expires_at".to_owned(), bounds.expires_at.into());
    parameters.insert(
        "operations".to_owned(),
        Term::Set(bounds.operations.iter().cloned().map(Term::from).collect()),
    );
    let mut builder = BlockBuilder::new();
    builder
        .add_code_with_params(
            r#"
check if resource({resource});
check if operation($operation), {operations}.contains($operation);
check if tenant({tenant});
check if time($time), $time < {expires_at};
"#,
            parameters,
            HashMap::new(),
        )
        .map_err(|_| AuthzError::new("auth.biscuit_invalid"))?;
    Ok(builder)
}

fn validate_identity(user_id: &str, tenant_id: &str, role: &str) -> Result<(), AuthzError> {
    if !valid_prefixed_id(user_id, "usr_")
        || !valid_prefixed_id(tenant_id, "ten_")
        || !valid_operation(role)
    {
        return Err(AuthzError::new("auth.biscuit_invalid"));
    }
    Ok(())
}

fn validate_bounds(
    tenant_id: &str,
    resource: &str,
    operations: &BTreeSet<String>,
) -> Result<(), AuthzError> {
    if !valid_prefixed_id(tenant_id, "ten_")
        || !valid_resource(resource)
        || operations.is_empty()
        || operations.len() > 20
        || operations
            .iter()
            .any(|operation| !valid_operation(operation))
    {
        return Err(AuthzError::new("auth.biscuit_invalid"));
    }
    Ok(())
}

pub(crate) fn valid_prefixed_id(value: &str, prefix: &str) -> bool {
    value.strip_prefix(prefix).is_some_and(|suffix| {
        (16..=64).contains(&suffix.len())
            && suffix
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
    })
}

fn validate_time(value: SystemTime) -> Result<(), AuthzError> {
    value
        .duration_since(UNIX_EPOCH)
        .map(|_| ())
        .map_err(|_| AuthzError::new("auth.biscuit_invalid"))
}

fn effective_expiration(value: SystemTime) -> Result<SystemTime, AuthzError> {
    let seconds = value
        .duration_since(UNIX_EPOCH)
        .map_err(|_| AuthzError::new("auth.biscuit_invalid"))?
        .as_secs();
    UNIX_EPOCH
        .checked_add(Duration::from_secs(seconds))
        .ok_or_else(|| AuthzError::new("auth.biscuit_invalid"))
}

pub(crate) fn valid_resource(value: &str) -> bool {
    (3..=512).contains(&value.len())
        && value.starts_with(|character: char| character.is_ascii_lowercase())
        && value.bytes().all(|byte| {
            byte.is_ascii_lowercase()
                || byte.is_ascii_digit()
                || matches!(byte, b'/' | b':' | b'.' | b'_' | b'-')
        })
}

pub(crate) fn valid_operation(value: &str) -> bool {
    (2..=64).contains(&value.len())
        && value.starts_with(|character: char| character.is_ascii_lowercase())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

pub(crate) fn root_block_id(token: &Biscuit) -> Result<String, AuthzError> {
    let authority_signature = token
        .revocation_identifiers()
        .into_iter()
        .next()
        .ok_or_else(|| AuthzError::new("auth.biscuit_invalid"))?;
    let digest = Sha256::digest(authority_signature);
    let mut encoded = String::with_capacity(64);
    for byte in digest {
        use std::fmt::Write;
        write!(&mut encoded, "{byte:02x}").map_err(|_| AuthzError::new("auth.biscuit_invalid"))?;
    }
    Ok(encoded)
}
