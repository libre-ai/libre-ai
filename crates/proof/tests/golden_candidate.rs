use libre_ai_artifact::{InputFile, ValidatedArtifactManifest};
use libre_ai_proof::{QualifiedReleaseCandidate, ValidatedEvidenceReport};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FixtureFile {
    path: String,
    media_type: String,
    content_utf8: String,
}

#[derive(Deserialize)]
struct Fixture {
    files: Vec<FixtureFile>,
    manifest: Value,
    evidence: Value,
}

#[test]
fn rust_qualifies_the_same_candidate_as_bun() {
    let fixture: Fixture = serde_json::from_str(include_str!(
        "../../../packages/evidence/fixtures/release-candidate.v1.json"
    ))
    .expect("golden fixture");
    let files = fixture
        .files
        .into_iter()
        .map(|file| InputFile::new(file.path, file.content_utf8.into_bytes(), file.media_type))
        .collect::<Vec<_>>();
    let manifest = ValidatedArtifactManifest::parse(
        &serde_json::to_vec(&fixture.manifest).expect("manifest JSON"),
    )
    .expect("validated golden manifest");
    let evidence = ValidatedEvidenceReport::parse(
        &serde_json::to_vec(&fixture.evidence).expect("evidence JSON"),
    )
    .expect("validated golden evidence");
    let candidate = QualifiedReleaseCandidate::qualify(manifest, evidence, &files)
        .expect("qualified golden candidate");
    assert_eq!(
        candidate.summary().artifact_digest,
        "aa2bff8a1e3226873b2495393c27de44ada131091aded2b01692a66f0f19c5af"
    );
    assert_eq!(
        candidate.summary().evidence_digest,
        "f7aca507c950554b2b71d1090275b24004de3eaaa8fa5086717bfde94dcc5a60"
    );
}
