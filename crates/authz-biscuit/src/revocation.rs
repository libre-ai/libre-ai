use crate::AuthzError;
use std::collections::{BTreeMap, VecDeque};
use std::time::{Duration, SystemTime};

const MAX_CACHE_ENTRIES: usize = 10_000;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RevocationRecord {
    pub root_block_id: String,
    pub reason_code: String,
    pub revoked_at: SystemTime,
    pub expires_at: SystemTime,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RevocationStoreUnavailable;

pub trait RevocationStore {
    fn is_revoked(&mut self, root_block_id: &str) -> Result<bool, RevocationStoreUnavailable>;

    fn revoke(&mut self, record: RevocationRecord) -> Result<(), RevocationStoreUnavailable>;
}

#[derive(Clone, Debug)]
struct CachedStatus {
    revoked: bool,
    checked_at: SystemTime,
}

pub struct RevocationChecker<S> {
    store: S,
    cache_ttl: Duration,
    cache: BTreeMap<String, CachedStatus>,
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
            cache: BTreeMap::new(),
            cache_order: VecDeque::new(),
        })
    }

    pub fn check(&mut self, root_block_id: &str, now: SystemTime) -> Result<(), AuthzError> {
        if !valid_root_block_id(root_block_id) {
            return Err(AuthzError::new("auth.biscuit_invalid"));
        }
        if let Some(cached) = self.cache.get(root_block_id) {
            let fresh = now
                .duration_since(cached.checked_at)
                .is_ok_and(|age| age <= self.cache_ttl);
            if fresh {
                return if cached.revoked {
                    Err(AuthzError::for_root("auth.biscuit_revoked", root_block_id))
                } else {
                    Ok(())
                };
            }
        }
        let revoked = self
            .store
            .is_revoked(root_block_id)
            .map_err(|_| AuthzError::for_root("auth.biscuit_invalid", root_block_id))?;
        self.remember(
            root_block_id,
            CachedStatus {
                revoked,
                checked_at: now,
            },
        );
        if revoked {
            Err(AuthzError::for_root("auth.biscuit_revoked", root_block_id))
        } else {
            Ok(())
        }
    }

    pub fn revoke(&mut self, record: RevocationRecord, now: SystemTime) -> Result<(), AuthzError> {
        if !valid_root_block_id(&record.root_block_id)
            || record.reason_code.is_empty()
            || record.reason_code.len() > 128
            || !record.reason_code.bytes().all(|byte| {
                byte.is_ascii_lowercase()
                    || byte.is_ascii_digit()
                    || matches!(byte, b'.' | b'_' | b'-')
            })
            || record.revoked_at > now
            || record.expires_at <= now
            || !record
                .expires_at
                .duration_since(record.revoked_at)
                .is_ok_and(|remaining| {
                    !remaining.is_zero() && remaining <= Duration::from_secs(900)
                })
        {
            return Err(AuthzError::new("auth.biscuit_invalid"));
        }
        let root_block_id = record.root_block_id.clone();
        self.store
            .revoke(record)
            .map_err(|_| AuthzError::for_root("auth.biscuit_invalid", &root_block_id))?;
        self.remember(
            &root_block_id,
            CachedStatus {
                revoked: true,
                checked_at: now,
            },
        );
        Ok(())
    }

    fn remember(&mut self, root_block_id: &str, status: CachedStatus) {
        if !self.cache.contains_key(root_block_id) {
            while self.cache.len() >= MAX_CACHE_ENTRIES {
                let Some(evicted) = self.cache_order.pop_front() else {
                    self.cache.clear();
                    break;
                };
                self.cache.remove(&evicted);
            }
            self.cache_order.push_back(root_block_id.to_owned());
        }
        self.cache.insert(root_block_id.to_owned(), status);
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
