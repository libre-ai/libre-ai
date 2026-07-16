#![forbid(unsafe_code)]

mod model;

pub use model::{
    EvidenceCheck, EvidenceProducer, EvidenceReport, EvidenceStatus, QualificationSummary,
};

use libre_ai_artifact::{
    ArtifactKind, ArtifactReference, InputFile, ValidatedArtifactManifest, canonical_json,
    sha256_hex,
};
use libre_ai_contract_types::ContractRegistry;
use serde_json::Value;
use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::sync::OnceLock;

const EVIDENCE_SCHEMA: &str = "evidence-report.v1.schema.json";
const EVIDENCE_SCHEMA_VERSION: &str = "libre-ai.evidence-report.v1";
static CONTRACTS: OnceLock<Result<ContractRegistry, String>> = OnceLock::new();

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProofError {
    pub code: &'static str,
    pub path: Option<String>,
}

impl ProofError {
    fn new(code: &'static str, path: Option<String>) -> Self {
        Self { code, path }
    }
}

impl Display for ProofError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.code)?;
        if let Some(path) = &self.path {
            write!(formatter, " at {path}")?;
        }
        Ok(())
    }
}

impl Error for ProofError {}

#[derive(Clone, Debug)]
pub struct ValidatedEvidenceReport(EvidenceReport);

impl ValidatedEvidenceReport {
    pub fn parse(bytes: &[u8]) -> Result<Self, ProofError> {
        let value: Value = serde_json::from_slice(bytes)
            .map_err(|_| ProofError::new("evidence.json_invalid", None))?;
        let issues = contracts()?
            .validate(EVIDENCE_SCHEMA, &value)
            .map_err(|_| ProofError::new("evidence.contract_unavailable", None))?;
        if let Some(issue) = issues.first() {
            return Err(ProofError::new(
                "evidence.schema_invalid",
                Some(issue.instance_path.clone()),
            ));
        }
        let report: EvidenceReport = serde_json::from_value(value)
            .map_err(|_| ProofError::new("evidence.decode_invalid", None))?;
        validate_checks(&report)?;
        Ok(Self(report))
    }

    #[must_use]
    pub fn report(&self) -> &EvidenceReport {
        &self.0
    }

    pub fn canonical_bytes(&self) -> Result<Vec<u8>, ProofError> {
        let value = serde_json::to_value(&self.0)
            .map_err(|_| ProofError::new("evidence.encode_failed", None))?;
        canonical_json(&value).map_err(|_| ProofError::new("evidence.encode_failed", None))
    }

    pub fn digest(&self) -> Result<String, ProofError> {
        Ok(sha256_hex(&self.canonical_bytes()?))
    }

    pub fn reference(&self) -> Result<ArtifactReference, ProofError> {
        Ok(ArtifactReference {
            id: self.0.id.clone(),
            digest: self.digest()?,
            media_type: "application/json".to_owned(),
        })
    }
}

pub fn build_evidence_report(
    id: impl Into<String>,
    subject: impl Into<String>,
    subject_digest: impl Into<String>,
    generated_at: impl Into<String>,
    producer: EvidenceProducer,
    mut checks: Vec<EvidenceCheck>,
) -> Result<ValidatedEvidenceReport, ProofError> {
    checks.sort();
    if checks.windows(2).any(|pair| pair[0].id == pair[1].id) {
        return Err(ProofError::new("evidence.check_duplicate", None));
    }
    let status = if checks
        .iter()
        .any(|check| check.status == EvidenceStatus::Fail)
    {
        EvidenceStatus::Fail
    } else if checks
        .iter()
        .any(|check| check.status == EvidenceStatus::Indeterminate)
    {
        EvidenceStatus::Indeterminate
    } else {
        EvidenceStatus::Pass
    };
    let report = EvidenceReport {
        schema_version: EVIDENCE_SCHEMA_VERSION.to_owned(),
        id: id.into(),
        subject: subject.into(),
        subject_digest: subject_digest.into(),
        status,
        checks,
        generated_at: generated_at.into(),
        producer,
    };
    let bytes =
        serde_json::to_vec(&report).map_err(|_| ProofError::new("evidence.encode_failed", None))?;
    ValidatedEvidenceReport::parse(&bytes)
}

#[derive(Clone, Debug)]
pub struct QualifiedReleaseCandidate {
    manifest: ValidatedArtifactManifest,
    evidence: ValidatedEvidenceReport,
    summary: QualificationSummary,
}

impl QualifiedReleaseCandidate {
    pub fn qualify(
        manifest: ValidatedArtifactManifest,
        evidence: ValidatedEvidenceReport,
        files: &[InputFile],
    ) -> Result<Self, ProofError> {
        manifest
            .verify_files(files)
            .map_err(|error| ProofError::new(error.code, error.path))?;
        let artifact = manifest.manifest();
        if !matches!(
            artifact.artifact_type,
            ArtifactKind::Build | ArtifactKind::Release
        ) {
            return Err(ProofError::new("evidence.artifact_kind_unqualified", None));
        }
        let report = evidence.report();
        if report.status != EvidenceStatus::Pass {
            return Err(ProofError::new("evidence.report_not_passing", None));
        }
        if report.subject != artifact.id || report.subject_digest != artifact.digest {
            return Err(ProofError::new("evidence.subject_mismatch", None));
        }
        let expected_reference = artifact
            .evidence_report
            .as_ref()
            .ok_or_else(|| ProofError::new("evidence.reference_missing", None))?;
        let actual_reference = evidence.reference()?;
        if expected_reference != &actual_reference {
            return Err(ProofError::new("evidence.reference_mismatch", None));
        }
        let summary = QualificationSummary {
            artifact_id: artifact.id.clone(),
            artifact_digest: artifact.digest.clone(),
            evidence_id: report.id.clone(),
            evidence_digest: actual_reference.digest,
            status: EvidenceStatus::Pass,
        };
        Ok(Self {
            manifest,
            evidence,
            summary,
        })
    }

    #[must_use]
    pub fn summary(&self) -> &QualificationSummary {
        &self.summary
    }

    #[must_use]
    pub fn manifest(&self) -> &ValidatedArtifactManifest {
        &self.manifest
    }

    #[must_use]
    pub fn evidence(&self) -> &ValidatedEvidenceReport {
        &self.evidence
    }
}

fn validate_checks(report: &EvidenceReport) -> Result<(), ProofError> {
    if report
        .checks
        .windows(2)
        .any(|pair| pair[0].id >= pair[1].id)
    {
        return Err(ProofError::new("evidence.checks_not_canonical", None));
    }
    let derived = if report
        .checks
        .iter()
        .any(|check| check.status == EvidenceStatus::Fail)
    {
        EvidenceStatus::Fail
    } else if report
        .checks
        .iter()
        .any(|check| check.status == EvidenceStatus::Indeterminate)
    {
        EvidenceStatus::Indeterminate
    } else {
        EvidenceStatus::Pass
    };
    if report.status != derived {
        return Err(ProofError::new("evidence.status_inconsistent", None));
    }
    Ok(())
}

fn contracts() -> Result<&'static ContractRegistry, ProofError> {
    CONTRACTS
        .get_or_init(|| ContractRegistry::embedded().map_err(|error| error.to_string()))
        .as_ref()
        .map_err(|_| ProofError::new("evidence.contract_unavailable", None))
}
