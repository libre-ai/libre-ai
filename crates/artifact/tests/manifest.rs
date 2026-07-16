use libre_ai_artifact::{
    ArtifactKind, ArtifactReference, InputFile, ValidatedArtifactManifest, build_manifest,
    content_digest,
};
use serde_json::Value;

fn evidence_reference() -> ArtifactReference {
    ArtifactReference {
        id: "urn:libre-ai:evidence:report-1".to_owned(),
        digest: "c".repeat(64),
        media_type: "application/json".to_owned(),
    }
}

fn files() -> Vec<InputFile> {
    vec![
        InputFile::new("dist/z.css", b"body{}".to_vec(), "text/css"),
        InputFile::new(
            "dist/app.js",
            b"console.log('libre-ai');\n".to_vec(),
            "text/javascript",
        ),
    ]
}

#[test]
fn builds_a_byte_identical_sorted_manifest_for_any_input_order() {
    let input = files();
    let first = build_manifest(
        "urn:libre-ai:artifact:release-1",
        ArtifactKind::Release,
        "2026-07-16T00:00:00Z",
        &input,
        Some(evidence_reference()),
    )
    .expect("release manifest");
    let reversed = build_manifest(
        "urn:libre-ai:artifact:release-1",
        ArtifactKind::Release,
        "2026-07-16T00:00:00Z",
        &input.into_iter().rev().collect::<Vec<_>>(),
        Some(evidence_reference()),
    )
    .expect("reversed release manifest");
    assert_eq!(
        first.canonical_bytes().expect("canonical manifest"),
        reversed
            .canonical_bytes()
            .expect("canonical reversed manifest")
    );
    assert_eq!(
        first.manifest().digest,
        content_digest(&files()).expect("content digest")
    );
    assert_eq!(first.manifest().files[0].path, "dist/app.js");
}

#[test]
fn refuses_release_without_evidence_and_hostile_or_duplicate_paths() {
    assert_eq!(
        build_manifest(
            "urn:libre-ai:artifact:release-1",
            ArtifactKind::Release,
            "2026-07-16T00:00:00Z",
            &files(),
            None,
        )
        .expect_err("release evidence is mandatory")
        .code,
        "artifact.evidence_required"
    );

    for hostile in [
        "../secret",
        "/absolute",
        "dist\\file",
        "dist//file",
        "C:/file",
        "./file",
        "dist/hostile\nname",
        "dist/résultat.json",
    ] {
        let error = build_manifest(
            "urn:libre-ai:artifact:dataset-1",
            ArtifactKind::Dataset,
            "2026-07-16T00:00:00Z",
            &[InputFile::new(hostile, b"private".to_vec(), "text/plain")],
            None,
        )
        .expect_err("hostile path must fail");
        assert_eq!(error.code, "artifact.path_invalid");
        assert_eq!(error.path.as_deref(), Some("/files"));
        assert!(!error.to_string().contains(hostile));
    }

    let duplicate = vec![
        InputFile::new("dist/app.js", b"one".to_vec(), "text/javascript"),
        InputFile::new("dist/app.js", b"two".to_vec(), "text/javascript"),
    ];
    assert_eq!(
        content_digest(&duplicate)
            .expect_err("duplicate file path must fail")
            .code,
        "artifact.file_duplicate"
    );
}

#[test]
fn refuses_noncanonical_or_digest_divergent_manifest_and_file_bytes() {
    let input = files();
    let manifest = build_manifest(
        "urn:libre-ai:artifact:release-1",
        ArtifactKind::Release,
        "2026-07-16T00:00:00Z",
        &input,
        Some(evidence_reference()),
    )
    .expect("release manifest");

    let mut unordered = serde_json::to_value(manifest.manifest()).expect("manifest JSON");
    unordered["files"]
        .as_array_mut()
        .expect("manifest files")
        .reverse();
    assert_eq!(
        ValidatedArtifactManifest::parse(
            &serde_json::to_vec(&unordered).expect("unordered manifest JSON")
        )
        .expect_err("unordered manifest must fail")
        .code,
        "artifact.files_not_sorted"
    );

    let mut wrong_digest = serde_json::to_value(manifest.manifest()).expect("manifest JSON");
    wrong_digest["digest"] = Value::String("0".repeat(64));
    assert_eq!(
        ValidatedArtifactManifest::parse(
            &serde_json::to_vec(&wrong_digest).expect("wrong digest manifest JSON")
        )
        .expect_err("manifest digest mismatch must fail")
        .code,
        "artifact.manifest_digest_mismatch"
    );

    let mut tampered = files();
    tampered[0].bytes.push(b'!');
    assert_eq!(
        manifest
            .verify_files(&tampered)
            .expect_err("tampered file bytes must fail")
            .code,
        "artifact.file_size_mismatch"
    );
}
