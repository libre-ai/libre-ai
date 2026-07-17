use aes_gcm::aead::{AeadInPlace, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce, Tag};
use argon2::{Algorithm, Argon2, Block, Params, Version};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde::Serialize;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use zeroize::Zeroizing;

use crate::canonical::serialize_jcs;
use crate::error::ErrorCode;
use crate::validate::{GCM_TAG_BYTES, KEY_BYTES};

const AAD_DOMAIN: &[u8] = b"libre-ai.notebook-backup.v2/aad";
const DIGEST_DOMAIN: &[u8] = b"libre-ai.notebook-backup.v2/digest";
const JCS_METADATA_RESERVE: usize = 1024;
const JCS_ENVELOPE_OVERHEAD: usize = 2048;

pub(crate) fn derive_key(
    recovery_secret: &[u8],
    salt: &[u8],
    memory_kib: u32,
    iterations: u32,
    parallelism: u32,
) -> Result<Zeroizing<[u8; KEY_BYTES]>, ErrorCode> {
    let params = Params::new(memory_kib, iterations, parallelism, Some(KEY_BYTES))
        .map_err(|_| ErrorCode::InternalFailure)?;
    let block_count = params.block_count();
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut memory = Zeroizing::new(Vec::<Block>::new());
    memory
        .try_reserve_exact(block_count)
        .map_err(|_| ErrorCode::ResourceLimitExceeded)?;
    memory.resize(block_count, Block::default());

    let mut key = Zeroizing::new([0u8; KEY_BYTES]);
    argon2
        .hash_password_into_with_memory(recovery_secret, salt, key.as_mut(), memory.as_mut_slice())
        .map_err(|_| ErrorCode::InternalFailure)?;
    Ok(key)
}

pub(crate) fn encrypt_in_place(
    plaintext: &mut Zeroizing<Vec<u8>>,
    key: &[u8; KEY_BYTES],
    nonce: &[u8],
    aad: &[u8],
) -> Result<(), ErrorCode> {
    plaintext
        .try_reserve_exact(GCM_TAG_BYTES)
        .map_err(|_| ErrorCode::ResourceLimitExceeded)?;
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| ErrorCode::InternalFailure)?;
    let tag = cipher
        .encrypt_in_place_detached(Nonce::from_slice(nonce), aad, plaintext.as_mut())
        .map_err(|_| ErrorCode::InternalFailure)?;
    plaintext.extend_from_slice(tag.as_slice());
    Ok(())
}

pub(crate) fn decrypt_in_place(
    ciphertext_and_tag: &mut Zeroizing<Vec<u8>>,
    key: &[u8; KEY_BYTES],
    nonce: &[u8],
    aad: &[u8],
) -> bool {
    let encrypted_len = ciphertext_and_tag.len() - GCM_TAG_BYTES;
    let mut tag_bytes = [0u8; GCM_TAG_BYTES];
    tag_bytes.copy_from_slice(&ciphertext_and_tag[encrypted_len..]);
    ciphertext_and_tag.truncate(encrypted_len);

    let Ok(cipher) = Aes256Gcm::new_from_slice(key) else {
        return false;
    };
    cipher
        .decrypt_in_place_detached(
            Nonce::from_slice(nonce),
            aad,
            ciphertext_and_tag.as_mut(),
            Tag::from_slice(&tag_bytes),
        )
        .is_ok()
}

pub(crate) fn aad_for_metadata<T: Serialize>(metadata: &T) -> Result<Vec<u8>, ErrorCode> {
    let canonical = serialize_jcs(metadata, JCS_METADATA_RESERVE)?;
    domain_preimage(AAD_DOMAIN, &canonical)
}

pub(crate) fn digest_for_body<T: Serialize>(
    body: &T,
    ciphertext_base64_len: usize,
) -> Result<[u8; 32], ErrorCode> {
    let reserve = ciphertext_base64_len
        .checked_add(JCS_ENVELOPE_OVERHEAD)
        .ok_or(ErrorCode::ResourceLimitExceeded)?;
    let canonical = serialize_jcs(body, reserve)?;
    let mut hasher = Sha256::new();
    hasher.update(DIGEST_DOMAIN);
    hasher.update([0]);
    hasher.update(canonical);
    Ok(hasher.finalize().into())
}

pub(crate) fn digest_matches(actual_hex: &str, expected: &[u8; 32]) -> bool {
    parse_sha256_hex(actual_hex)
        .map(|actual| bool::from(actual.ct_eq(expected)))
        .unwrap_or(false)
}

pub(crate) fn sha256_hex(value: &[u8; 32]) -> Result<String, ErrorCode> {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::new();
    output
        .try_reserve_exact(64)
        .map_err(|_| ErrorCode::ResourceLimitExceeded)?;
    for byte in value {
        output.push(char::from(HEX[usize::from(byte >> 4)]));
        output.push(char::from(HEX[usize::from(byte & 0x0f)]));
    }
    Ok(output)
}

pub(crate) fn encode_base64(value: &[u8]) -> Result<String, ErrorCode> {
    let length = base64::encoded_len(value.len(), true).ok_or(ErrorCode::ResourceLimitExceeded)?;
    let mut output = Vec::new();
    output
        .try_reserve_exact(length)
        .map_err(|_| ErrorCode::ResourceLimitExceeded)?;
    output.resize(length, 0);
    let written = STANDARD
        .encode_slice(value, &mut output)
        .map_err(|_| ErrorCode::InternalFailure)?;
    output.truncate(written);
    String::from_utf8(output).map_err(|_| ErrorCode::InternalFailure)
}

pub(crate) fn decode_canonical_base64(value: &str) -> Result<Vec<u8>, ErrorCode> {
    let estimated = base64::decoded_len_estimate(value.len());
    let mut decoded = Vec::new();
    decoded
        .try_reserve_exact(estimated)
        .map_err(|_| ErrorCode::ResourceLimitExceeded)?;
    decoded.resize(estimated, 0);
    let written = STANDARD
        .decode_slice(value.as_bytes(), &mut decoded)
        .map_err(|_| ErrorCode::InvalidEnvelope)?;
    decoded.truncate(written);
    // STANDARD requires canonical padding and rejects non-zero trailing bits,
    // making successful decoding equivalent to the contract's decode/re-encode check.
    Ok(decoded)
}

fn domain_preimage(domain: &[u8], canonical: &[u8]) -> Result<Vec<u8>, ErrorCode> {
    let length = domain
        .len()
        .checked_add(1)
        .and_then(|length| length.checked_add(canonical.len()))
        .ok_or(ErrorCode::ResourceLimitExceeded)?;
    let mut output = Vec::new();
    output
        .try_reserve_exact(length)
        .map_err(|_| ErrorCode::ResourceLimitExceeded)?;
    output.extend_from_slice(domain);
    output.push(0);
    output.extend_from_slice(canonical);
    Ok(output)
}

fn parse_sha256_hex(value: &str) -> Option<[u8; 32]> {
    if value.len() != 64 {
        return None;
    }
    let mut output = [0u8; 32];
    for (index, pair) in value.as_bytes().chunks_exact(2).enumerate() {
        output[index] = (hex_nibble(pair[0])? << 4) | hex_nibble(pair[1])?;
    }
    Some(output)
}

const fn hex_nibble(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{decode_canonical_base64, digest_matches, encode_base64, sha256_hex};
    use crate::ErrorCode;

    #[test]
    fn accepts_only_canonical_padded_base64() {
        let value = b"canonical bytes!";
        let encoded = encode_base64(value).unwrap();
        assert_eq!(decode_canonical_base64(&encoded).unwrap(), value);
        assert_eq!(
            decode_canonical_base64(encoded.trim_end_matches('=')),
            Err(ErrorCode::InvalidEnvelope)
        );
        assert_eq!(
            decode_canonical_base64("Y2Fub25pY2FsIGJ5dGVz\n"),
            Err(ErrorCode::InvalidEnvelope)
        );
        assert_eq!(
            decode_canonical_base64("Zh=="),
            Err(ErrorCode::InvalidEnvelope)
        );
    }

    #[test]
    fn formats_and_compares_lowercase_sha256() {
        let digest = [0xabu8; 32];
        let encoded = sha256_hex(&digest).unwrap();
        assert_eq!(encoded, "ab".repeat(32));
        assert!(digest_matches(&encoded, &digest));
        assert!(!digest_matches(&"AB".repeat(32), &digest));
    }
}
