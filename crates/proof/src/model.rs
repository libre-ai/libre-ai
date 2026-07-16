use libre_ai_artifact::ArtifactReference;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EvidenceStatus {
    Pass,
    Fail,
    Indeterminate,
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EvidenceCheck {
    pub id: String,
    pub status: EvidenceStatus,
    #[serde(rename = "ruleVersion")]
    pub rule_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence: Option<ArtifactReference>,
    #[serde(rename = "reasonCode", skip_serializing_if = "Option::is_none")]
    pub reason_code: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EvidenceProducer {
    pub name: String,
    pub version: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct EvidenceReport {
    #[serde(rename = "schemaVersion")]
    pub schema_version: String,
    pub id: String,
    pub subject: String,
    #[serde(rename = "subjectDigest")]
    pub subject_digest: String,
    pub status: EvidenceStatus,
    pub checks: Vec<EvidenceCheck>,
    #[serde(rename = "generatedAt")]
    pub generated_at: String,
    pub producer: EvidenceProducer,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct QualificationSummary {
    #[serde(rename = "artifactId")]
    pub artifact_id: String,
    #[serde(rename = "artifactDigest")]
    pub artifact_digest: String,
    #[serde(rename = "evidenceId")]
    pub evidence_id: String,
    #[serde(rename = "evidenceDigest")]
    pub evidence_digest: String,
    pub status: EvidenceStatus,
}
