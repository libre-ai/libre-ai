use crate::AuthzError;
use biscuit_auth::PublicKey;
use std::collections::{BTreeMap, BTreeSet};
use std::time::SystemTime;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum VerificationKeyStatus {
    Current,
    Retiring,
}

#[derive(Clone, Debug)]
pub struct VerificationKey {
    pub key_id: u32,
    pub public_key: PublicKey,
    pub valid_from: SystemTime,
    pub valid_until: Option<SystemTime>,
    pub status: VerificationKeyStatus,
}

#[derive(Clone, Debug)]
pub struct PublicKeyMetadata {
    pub key_id: u32,
    pub algorithm: &'static str,
    pub public_key_hex: String,
    pub valid_from: SystemTime,
    pub valid_until: Option<SystemTime>,
    pub status: VerificationKeyStatus,
}

#[derive(Clone, Debug)]
pub struct VerificationKeyRing {
    keys: BTreeMap<u32, VerificationKey>,
    used_key_ids: BTreeSet<u32>,
}

impl VerificationKeyRing {
    pub fn new(current: VerificationKey) -> Result<Self, AuthzError> {
        if current.status != VerificationKeyStatus::Current
            || current.valid_until.is_some()
            || current.public_key.algorithm_string() != "ed25519"
        {
            return Err(AuthzError::new("auth.key_rotation_invalid"));
        }
        let key_id = current.key_id;
        Ok(Self {
            keys: BTreeMap::from([(key_id, current)]),
            used_key_ids: BTreeSet::from([key_id]),
        })
    }

    pub fn begin_rotation(
        &mut self,
        new_key: VerificationKey,
        old_key_valid_until: SystemTime,
    ) -> Result<(), AuthzError> {
        if self.keys.len() != 1
            || new_key.status != VerificationKeyStatus::Current
            || new_key.valid_until.is_some()
            || new_key.public_key.algorithm_string() != "ed25519"
            || self.used_key_ids.contains(&new_key.key_id)
            || self
                .keys
                .values()
                .any(|key| key.public_key == new_key.public_key)
        {
            return Err(AuthzError::new("auth.key_rotation_invalid"));
        }
        let current = self
            .keys
            .values_mut()
            .next()
            .ok_or_else(|| AuthzError::new("auth.key_rotation_invalid"))?;
        if old_key_valid_until <= new_key.valid_from || old_key_valid_until <= current.valid_from {
            return Err(AuthzError::new("auth.key_rotation_invalid"));
        }
        current.status = VerificationKeyStatus::Retiring;
        current.valid_until = Some(old_key_valid_until);
        self.used_key_ids.insert(new_key.key_id);
        self.keys.insert(new_key.key_id, new_key);
        Ok(())
    }

    pub fn finish_rotation(&mut self, now: SystemTime) -> Result<(), AuthzError> {
        self.keys.retain(|_, key| {
            key.status == VerificationKeyStatus::Current
                || key.valid_until.is_some_and(|valid_until| now < valid_until)
        });
        if self.keys.len() != 1
            || self
                .keys
                .values()
                .any(|key| key.status != VerificationKeyStatus::Current)
        {
            return Err(AuthzError::new("auth.key_rotation_not_ready"));
        }
        Ok(())
    }

    pub fn revoke_key(&mut self, key_id: u32) {
        self.keys.remove(&key_id);
    }

    pub(crate) fn select(&self, key_id: u32, now: SystemTime) -> Result<PublicKey, AuthzError> {
        let key = self
            .keys
            .get(&key_id)
            .ok_or_else(|| AuthzError::new("auth.key_unavailable"))?;
        if now < key.valid_from
            || key
                .valid_until
                .is_some_and(|valid_until| now >= valid_until)
        {
            return Err(AuthzError::new("auth.key_unavailable"));
        }
        Ok(key.public_key)
    }

    pub fn public_keys(&self) -> Vec<PublicKeyMetadata> {
        self.keys
            .values()
            .map(|key| PublicKeyMetadata {
                key_id: key.key_id,
                algorithm: "Ed25519",
                public_key_hex: key.public_key.to_bytes_hex(),
                valid_from: key.valid_from,
                valid_until: key.valid_until,
                status: key.status,
            })
            .collect()
    }
}
