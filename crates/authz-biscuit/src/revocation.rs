use crate::AuthzError;
use std::collections::{BTreeMap, VecDeque};
use std::time::{Duration, SystemTime};

const MAX_CACHE_ENTRIES: usize = 10_000;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RevocationTarget {
    root_block_id: String,
    expires_at: SystemTime,
}

impl RevocationTarget {
    pub(crate) fn new(root_block_id: String, expires_at: SystemTime) -> Self {
        Self {
            root_block_id,
            expires_at,
        }
    }

    #[must_use]
    pub fn root_block_id(&self) -> &str {
        &self.root_block_id
    }

    #[must_use]
    pub fn expires_at(&self) -> SystemTime {
        self.expires_at
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RevocationRecord {
    root_block_id: String,
    reason_code: String,
    revoked_at: SystemTime,
    expires_at: SystemTime,
}

impl RevocationRecord {
    #[must_use]
    pub fn root_block_id(&self) -> &str {
        &self.root_block_id
    }

    #[must_use]
    pub fn reason_code(&self) -> &str {
        &self.reason_code
    }

    #[must_use]
    pub fn revoked_at(&self) -> SystemTime {
        self.revoked_at
    }

    #[must_use]
    pub fn expires_at(&self) -> SystemTime {
        self.expires_at
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RevocationStoreUnavailable;

pub trait RevocationStore {
    fn is_revoked(&mut self, root_block_id: &str) -> Result<bool, RevocationStoreUnavailable>;

    fn revoke(&mut self, record: RevocationRecord) -> Result<(), RevocationStoreUnavailable>;
}

pub struct RevocationChecker<S> {
    store: S,
    cache_ttl: Duration,
    revoked_cache: BTreeMap<String, SystemTime>,
    cache_order: VecDeque<String>,
}

impl<S: RevocationStore> RevocationChecker<S> {
    pub fn new(store: S, cache_ttl: Duration) -> Result<Self, AuthzError> {
        if cache_ttl > Duration::from_secs(30) {
            return Err(AuthzError::new("auth.biscuit_invalid"));
        }
        Ok(Self {
            store,
            cache_ttl,
            revoked_cache: BTreeMap::new(),
            cache_order: VecDeque::new(),
        })
    }

    pub fn check(&mut self, root_block_id: &str, now: SystemTime) -> Result<(), AuthzError> {
        if !valid_root_block_id(root_block_id) {
            return Err(AuthzError::new("auth.biscuit_invalid"));
        }
        // Only a *revoked* verdict is ever cached. Revocation is monotonic, so
        // a fresh cached revocation can be served without a store round trip. A
        // not-revoked verdict is never cached: every acceptance re-consults the
        // store, so an emergency revocation written by another verifier instance
        // to the shared store takes effect immediately. A negative cache would
        // otherwise let this instance keep accepting a revoked token for up to
        // `cache_ttl` — a bounded fail-open window this design forbids.
        if let Some(cached_at) = self.revoked_cache.get(root_block_id) {
            let fresh = now
                .duration_since(*cached_at)
                .is_ok_and(|age| age <= self.cache_ttl);
            if fresh {
                return Err(AuthzError::for_root("auth.biscuit_revoked", root_block_id));
            }
        }
        let revoked = self
            .store
            .is_revoked(root_block_id)
            .map_err(|_| AuthzError::for_root("auth.biscuit_invalid", root_block_id))?;
        if revoked {
            self.remember(root_block_id, now);
            Err(AuthzError::for_root("auth.biscuit_revoked", root_block_id))
        } else {
            Ok(())
        }
    }

    pub fn revoke(
        &mut self,
        target: &RevocationTarget,
        reason_code: String,
        now: SystemTime,
    ) -> Result<(), AuthzError> {
        let remaining = target.expires_at.duration_since(now);
        if !valid_root_block_id(&target.root_block_id)
            || reason_code.is_empty()
            || reason_code.len() > 128
            || !reason_code.bytes().all(|byte| {
                byte.is_ascii_lowercase()
                    || byte.is_ascii_digit()
                    || matches!(byte, b'.' | b'_' | b'-')
            })
            || !remaining.is_ok_and(|remaining| {
                !remaining.is_zero() && remaining <= Duration::from_secs(900)
            })
        {
            return Err(AuthzError::new("auth.biscuit_invalid"));
        }
        let root_block_id = target.root_block_id.clone();
        self.store
            .revoke(RevocationRecord {
                root_block_id: root_block_id.clone(),
                reason_code,
                revoked_at: now,
                expires_at: target.expires_at,
            })
            .map_err(|_| AuthzError::for_root("auth.biscuit_invalid", &root_block_id))?;
        self.remember(&root_block_id, now);
        Ok(())
    }

    fn remember(&mut self, root_block_id: &str, cached_at: SystemTime) {
        if !self.revoked_cache.contains_key(root_block_id) {
            while self.revoked_cache.len() >= MAX_CACHE_ENTRIES {
                let Some(evicted) = self.cache_order.pop_front() else {
                    self.revoked_cache.clear();
                    break;
                };
                self.revoked_cache.remove(&evicted);
            }
            self.cache_order.push_back(root_block_id.to_owned());
        }
        self.revoked_cache
            .insert(root_block_id.to_owned(), cached_at);
    }

    pub fn into_store(self) -> S {
        self.store
    }
}

fn valid_root_block_id(root_block_id: &str) -> bool {
    root_block_id.len() == 64
        && root_block_id
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
}
