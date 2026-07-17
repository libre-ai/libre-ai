# Dependency qualification — experimental Notebook Core

All versions are exact workspace pins. `cargo deny check advisories licenses sources` is mandatory.

| Crate | Scope | Features | Licence | Rationale |
| --- | --- | --- | --- | --- |
| `argon2 0.5.3` | runtime | `zeroize`; no defaults/alloc/password-hash/rand | MIT OR Apache-2.0 | RustCrypto Argon2id v19; caller-provided memory via `hash_password_into_with_memory` |
| `aes-gcm 0.10.3` | runtime | `aes`, `zeroize`; no defaults/alloc/getrandom | MIT OR Apache-2.0 | RustCrypto AES-256-GCM, detached 16-byte tag, in-place API |
| `aes 0.8.4`, `ghash 0.5.1`, `polyval 0.6.2` | runtime feature anchors | `zeroize`; no defaults | MIT OR Apache-2.0 | force wiping of AES schedules plus GHASH/POLYVAL temporary and retained state on the WASM software backend |
| `base64 0.22.1` | runtime | `alloc`; no std default | MIT OR Apache-2.0 | strict RFC 4648 standard alphabet with decode/re-encode check |
| `sha2 0.11.0` | runtime | no defaults | MIT OR Apache-2.0 | SHA-256 envelope and Context digests |
| `subtle 2.6.1` | runtime | no defaults | BSD-3-Clause | constant-time digest comparison |
| `zeroize 1.9.0` | runtime | derive | MIT OR Apache-2.0 | scoped wiping for secret/key/plaintext/Argon2 blocks |
| `serde 1.0.228`, `serde_json 1.0.150` | runtime | workspace | MIT OR Apache-2.0 | strict typed envelope/context parsing with duplicate and unknown-field refusal |
| `serde_jcs 0.2.0` | runtime | defaults | MIT OR Apache-2.0 | RFC 8785 serialization; dependency implementation remains a Gate R audit target |
| `wit-bindgen 0.59.0` | runtime boundary | macros, realloc; no defaults/std/async | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | generated Component Model ABI from the locked v2 WIT |
| `wasmparser 0.253.0`, `wit-component 0.253.0` | development only | defaults | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | encode and inspect the actual component imports/exports |

No runtime dependency supplies clock, randomness, network, filesystem, storage, environment, logging,
thread pool, PHC string, or external service. The export-scoped id, salt, nonce, and 16-byte recovery secret are explicit host inputs.

## Review notes

- `argon2`'s convenience `hash_password_into` is intentionally not used because it allocates its
  block matrix internally. The engine fallibly preallocates and wraps caller-owned blocks in
  `Zeroizing`.
- Disabling Argon2 `alloc` also removes the `password-hash`/`rand_core` path from this crate's feature
  graph.
- `aes-gcm/zeroize` alone wipes only its temporary GHASH key. Direct feature anchors therefore enable
  `aes/zeroize`, `ghash/zeroize`, and `polyval/zeroize`; Gate B must verify the exact WASM backend.
- The AES-GCM implementation and JCS serializer are third-party cryptographic/canonicalization code;
  golden vectors, component qualification, advisories, source provenance, and Gate R remain required.
- First-party code denies unsafe Rust. Generated WIT glue and dependencies are audited separately.
