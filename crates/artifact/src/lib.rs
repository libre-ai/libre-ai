#![forbid(unsafe_code)]

mod canonical;
mod model;

pub use canonical::{canonical_json, sha256_hex};
pub use model::{ArtifactFile, ArtifactKind, ArtifactManifest, ArtifactReference, InputFile};

use libre_ai_contract_types::ContractRegistry;
use serde_json::Value;
use std::collections::BTreeMap;
use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::path::{Component, Path};
use std::sync::OnceLock;

const ARTIFACT_SCHEMA: &str = "artifact-manifest.v1.schema.json";
const ARTIFACT_SCHEMA_VERSION: &str = "libre-ai.artifact-manifest.v1";
static CONTRACTS: OnceLock<Result<ContractRegistry, String>> = OnceLock::new();

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArtifactError {
    pub code: &'static str,
    pub path: Option<String>,
}

impl ArtifactError {
    fn new(code: &'static str, path: Option<String>) -> Self {
        Self { code, path }
    }
}

impl Display for ArtifactError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.code)?;
        if let Some(path) = &self.path {
            write!(formatter, " at {path}")?;
        }
        Ok(())
    }
}

impl Error for ArtifactError {}

#[derive(Clone, Debug)]
pub struct ValidatedArtifactManifest(ArtifactManifest);

impl ValidatedArtifactManifest {
    pub fn parse(bytes: &[u8]) -> Result<Self, ArtifactError> {
        let value: Value = serde_json::from_slice(bytes)
            .map_err(|_| ArtifactError::new("artifact.json_invalid", None))?;
        let issues = contracts()?
            .validate(ARTIFACT_SCHEMA, &value)
            .map_err(|_| ArtifactError::new("artifact.contract_unavailable", None))?;
        if let Some(issue) = issues.first() {
            return Err(ArtifactError::new(
                "artifact.schema_invalid",
                Some(issue.instance_path.clone()),
            ));
        }
        let manifest: ArtifactManifest = serde_json::from_value(value)
            .map_err(|_| ArtifactError::new("artifact.decode_invalid", None))?;
        validate_file_descriptors(&manifest.files)?;
        let expected = manifest_digest(&manifest.files)?;
        if manifest.digest != expected {
            return Err(ArtifactError::new(
                "artifact.manifest_digest_mismatch",
                None,
            ));
        }
        Ok(Self(manifest))
    }

    #[must_use]
    pub fn manifest(&self) -> &ArtifactManifest {
        &self.0
    }

    pub fn canonical_bytes(&self) -> Result<Vec<u8>, ArtifactError> {
        let value = serde_json::to_value(&self.0)
            .map_err(|_| ArtifactError::new("artifact.encode_failed", None))?;
        canonical_json(&value).map_err(|_| ArtifactError::new("artifact.encode_failed", None))
    }

    pub fn verify_files(&self, inputs: &[InputFile]) -> Result<(), ArtifactError> {
        let descriptors = descriptors_from_inputs(inputs)?;
        if descriptors != self.0.files {
            let manifest_by_path = self
                .0
                .files
                .iter()
                .map(|file| (file.path.as_str(), file))
                .collect::<BTreeMap<_, _>>();
            for descriptor in &descriptors {
                match manifest_by_path.get(descriptor.path.as_str()) {
                    None => {
                        return Err(ArtifactError::new(
                            "artifact.file_unexpected",
                            Some("/files".to_owned()),
                        ));
                    }
                    Some(expected) if expected.size != descriptor.size => {
                        return Err(ArtifactError::new(
                            "artifact.file_size_mismatch",
                            Some("/files".to_owned()),
                        ));
                    }
                    Some(expected) if expected.digest != descriptor.digest => {
                        return Err(ArtifactError::new(
                            "artifact.file_digest_mismatch",
                            Some("/files".to_owned()),
                        ));
                    }
                    Some(expected) if expected.media_type != descriptor.media_type => {
                        return Err(ArtifactError::new(
                            "artifact.file_media_type_mismatch",
                            Some("/files".to_owned()),
                        ));
                    }
                    Some(_) => {}
                }
            }
            return Err(ArtifactError::new("artifact.file_missing", None));
        }
        Ok(())
    }
}

pub fn content_digest(inputs: &[InputFile]) -> Result<String, ArtifactError> {
    manifest_digest(&descriptors_from_inputs(inputs)?)
}

pub fn build_manifest(
    id: impl Into<String>,
    artifact_type: ArtifactKind,
    created_at: impl Into<String>,
    inputs: &[InputFile],
    evidence_report: Option<ArtifactReference>,
) -> Result<ValidatedArtifactManifest, ArtifactError> {
    if artifact_type.requires_evidence() && evidence_report.is_none() {
        return Err(ArtifactError::new("artifact.evidence_required", None));
    }
    let files = descriptors_from_inputs(inputs)?;
    let manifest = ArtifactManifest {
        schema_version: ARTIFACT_SCHEMA_VERSION.to_owned(),
        id: id.into(),
        artifact_type,
        created_at: created_at.into(),
        digest: manifest_digest(&files)?,
        files,
        evidence_report,
    };
    let bytes = serde_json::to_vec(&manifest)
        .map_err(|_| ArtifactError::new("artifact.encode_failed", None))?;
    ValidatedArtifactManifest::parse(&bytes)
}

fn descriptors_from_inputs(inputs: &[InputFile]) -> Result<Vec<ArtifactFile>, ArtifactError> {
    if inputs.is_empty() {
        return Err(ArtifactError::new("artifact.files_empty", None));
    }
    let mut files = inputs
        .iter()
        .map(|input| {
            validate_path(&input.path)?;
            Ok(ArtifactFile {
                path: input.path.clone(),
                size: u64::try_from(input.bytes.len())
                    .map_err(|_| ArtifactError::new("artifact.file_too_large", None))?,
                digest: sha256_hex(&input.bytes),
                media_type: input.media_type.clone(),
            })
        })
        .collect::<Result<Vec<_>, ArtifactError>>()?;
    files.sort_by(|left, right| left.path.cmp(&right.path));
    validate_file_descriptors(&files)?;
    Ok(files)
}

fn validate_file_descriptors(files: &[ArtifactFile]) -> Result<(), ArtifactError> {
    if files.is_empty() {
        return Err(ArtifactError::new("artifact.files_empty", None));
    }
    let mut previous: Option<&str> = None;
    for file in files {
        validate_path(&file.path)?;
        if previous.is_some_and(|value| value >= file.path.as_str()) {
            return Err(ArtifactError::new(
                if previous == Some(file.path.as_str()) {
                    "artifact.file_duplicate"
                } else {
                    "artifact.files_not_sorted"
                },
                Some("/files".to_owned()),
            ));
        }
        previous = Some(&file.path);
    }
    Ok(())
}

fn validate_path(path: &str) -> Result<(), ArtifactError> {
    if path.is_empty()
        || !path.is_ascii()
        || path.contains('\\')
        || path.contains(':')
        || path.chars().any(char::is_control)
        || path
            .split('/')
            .any(|segment| segment.is_empty() || matches!(segment, "." | ".."))
    {
        return Err(ArtifactError::new(
            "artifact.path_invalid",
            Some("/files".to_owned()),
        ));
    }
    let parsed = Path::new(path);
    if parsed.is_absolute()
        || parsed
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(ArtifactError::new(
            "artifact.path_invalid",
            Some("/files".to_owned()),
        ));
    }
    Ok(())
}

fn manifest_digest(files: &[ArtifactFile]) -> Result<String, ArtifactError> {
    let value = serde_json::to_value(files)
        .map_err(|_| ArtifactError::new("artifact.encode_failed", None))?;
    let canonical =
        canonical_json(&value).map_err(|_| ArtifactError::new("artifact.encode_failed", None))?;
    Ok(sha256_hex(&canonical))
}

fn contracts() -> Result<&'static ContractRegistry, ArtifactError> {
    CONTRACTS
        .get_or_init(|| ContractRegistry::embedded().map_err(|error| error.to_string()))
        .as_ref()
        .map_err(|_| ArtifactError::new("artifact.contract_unavailable", None))
}
