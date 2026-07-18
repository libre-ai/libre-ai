#![forbid(unsafe_code)]

mod authorize;
mod error;
mod keys;
mod revocation;
mod token;

pub use authorize::{
    AuthorizationContext, AuthorizationDecision, CanonicalPolicy, VerifiedPrincipal, authorize,
};
pub use error::AuthzError;
pub use keys::{PublicKeyMetadata, VerificationKey, VerificationKeyRing, VerificationKeyStatus};
pub use revocation::{
    RevocationChecker, RevocationRecord, RevocationStore, RevocationStoreUnavailable,
};
pub use token::{
    AttenuationRequest, BiscuitIssuer, BoundedBiscuit, IssuanceRequest, SensitiveToken,
    SerializedBiscuit, TokenBounds,
};
