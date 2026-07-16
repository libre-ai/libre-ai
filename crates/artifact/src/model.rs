use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ArtifactKind {
    Build,
    Dataset,
    Export,
    Release,
    Evidence,
}

impl ArtifactKind {
    #[must_use]
    pub fn requires_evidence(self) -> bool {
        matches!(self, Self::Build | Self::Release)
    }
}

#[derive(Clone, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ArtifactReference {
    pub id: String,
    pub digest: String,
    #[serde(rename = "mediaType")]
    pub media_type: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ArtifactFile {
    pub path: String,
    pub size: u64,
    pub digest: String,
    #[serde(rename = "mediaType")]
    pub media_type: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ArtifactManifest {
    #[serde(rename = "schemaVersion")]
    pub schema_version: String,
    pub id: String,
    #[serde(rename = "artifactType")]
    pub artifact_type: ArtifactKind,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub digest: String,
    pub files: Vec<ArtifactFile>,
    #[serde(rename = "evidenceReport", skip_serializing_if = "Option::is_none")]
    pub evidence_report: Option<ArtifactReference>,
}

#[derive(Clone, Debug)]
pub struct InputFile {
    pub path: String,
    pub bytes: Vec<u8>,
    pub media_type: String,
}

impl InputFile {
    pub fn new(
        path: impl Into<String>,
        bytes: impl Into<Vec<u8>>,
        media_type: impl Into<String>,
    ) -> Self {
        Self {
            path: path.into(),
            bytes: bytes.into(),
            media_type: media_type.into(),
        }
    }
}
