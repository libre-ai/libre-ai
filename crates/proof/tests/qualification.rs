use libre_ai_artifact::{
    ArtifactKind, ArtifactReference, InputFile, build_manifest, content_digest,
};
use libre_ai_proof::{
    EvidenceCheck, EvidenceProducer, EvidenceStatus, QualifiedReleaseCandidate,
    ValidatedEvidenceReport, build_evidence_report,
};
use serde_json::Value;

fn files() -> Vec<InputFile> {
    vec![InputFile::new(
        "dist/app.js",
        b"console.log('libre-ai');\n".to_vec(),
        "text/javascript",
    )]
}

fn passing_check(id: &str) -> EvidenceCheck {
    EvidenceCheck {
        id: id.to_owned(),
        status: EvidenceStatus::Pass,
        rule_version: "1.0.0".to_owned(),
        evidence: None,
        reason_code: None,
    }
}

fn passing_evidence() -> libre_ai_proof::ValidatedEvidenceReport {
    build_evidence_report(
        "urn:libre-ai:evidence:release-1",
        "urn:libre-ai:artifact:release-1",
        content_digest(&files()).expect("artifact digest"),
        "2026-07-16T00:00:00Z",
        EvidenceProducer {
            name: "libre-ai-proof".to_owned(),
            version: "0.1.0".to_owned(),
        },
        vec![passing_check("supply-chain"), passing_check("contracts")],
    )
    .expect("passing evidence")
}

#[test]
fn qualifies_only_an_exact_passing_evidence_binding() {
    let evidence = passing_evidence();
    let manifest = build_manifest(
        "urn:libre-ai:artifact:release-1",
        ArtifactKind::Release,
        "2026-07-16T00:00:00Z",
        &files(),
        Some(evidence.reference().expect("evidence reference")),
    )
    .expect("release manifest");
    let candidate = QualifiedReleaseCandidate::qualify(manifest, evidence, &files())
        .expect("qualified release candidate");
    assert_eq!(candidate.summary().status, EvidenceStatus::Pass);
    assert_eq!(
        candidate.summary().artifact_id,
        "urn:libre-ai:artifact:release-1"
    );
}

#[test]
fn evidence_generation_is_deterministic_and_status_is_derived() {
    let first = build_evidence_report(
        "urn:libre-ai:evidence:release-1",
        "urn:libre-ai:artifact:release-1",
        content_digest(&files()).expect("artifact digest"),
        "2026-07-16T00:00:00Z",
        EvidenceProducer {
            name: "libre-ai-proof".to_owned(),
            version: "0.1.0".to_owned(),
        },
        vec![passing_check("z-check"), passing_check("a-check")],
    )
    .expect("first evidence");
    let second = build_evidence_report(
        "urn:libre-ai:evidence:release-1",
        "urn:libre-ai:artifact:release-1",
        content_digest(&files()).expect("artifact digest"),
        "2026-07-16T00:00:00Z",
        EvidenceProducer {
            name: "libre-ai-proof".to_owned(),
            version: "0.1.0".to_owned(),
        },
        vec![passing_check("a-check"), passing_check("z-check")],
    )
    .expect("second evidence");
    assert_eq!(
        first.canonical_bytes().expect("first canonical evidence"),
        second.canonical_bytes().expect("second canonical evidence")
    );
    assert_eq!(first.report().checks[0].id, "a-check");

    assert_eq!(
        build_evidence_report(
            "urn:libre-ai:evidence:duplicate",
            "urn:libre-ai:artifact:release-1",
            content_digest(&files()).expect("artifact digest"),
            "2026-07-16T00:00:00Z",
            EvidenceProducer {
                name: "libre-ai-proof".to_owned(),
                version: "0.1.0".to_owned(),
            },
            vec![passing_check("same-check"), passing_check("same-check")],
        )
        .expect_err("duplicate check IDs must fail")
        .code,
        "evidence.check_duplicate"
    );
}

#[test]
fn rejects_nonpassing_inconsistent_and_mismatched_evidence() {
    let mut failed = serde_json::to_value(passing_evidence().report()).expect("evidence JSON");
    failed["status"] = Value::String("fail".to_owned());
    failed["checks"][0]["status"] = Value::String("fail".to_owned());
    failed["checks"][0]["reasonCode"] = Value::String("proof.check_failed".to_owned());
    let failed =
        ValidatedEvidenceReport::parse(&serde_json::to_vec(&failed).expect("failed evidence JSON"))
            .expect("consistent failed evidence");
    let manifest = build_manifest(
        "urn:libre-ai:artifact:release-1",
        ArtifactKind::Release,
        "2026-07-16T00:00:00Z",
        &files(),
        Some(failed.reference().expect("failed evidence reference")),
    )
    .expect("manifest bound to failed evidence");
    assert_eq!(
        QualifiedReleaseCandidate::qualify(manifest, failed, &files())
            .expect_err("failed evidence cannot qualify")
            .code,
        "evidence.report_not_passing"
    );

    let passing = passing_evidence();
    let mismatched_reference = ArtifactReference {
        id: passing.report().id.clone(),
        digest: "0".repeat(64),
        media_type: "application/json".to_owned(),
    };
    let manifest = build_manifest(
        "urn:libre-ai:artifact:release-1",
        ArtifactKind::Release,
        "2026-07-16T00:00:00Z",
        &files(),
        Some(mismatched_reference),
    )
    .expect("schema-valid mismatched reference");
    assert_eq!(
        QualifiedReleaseCandidate::qualify(manifest, passing, &files())
            .expect_err("mismatched evidence digest cannot qualify")
            .code,
        "evidence.reference_mismatch"
    );

    let mut inconsistent =
        serde_json::to_value(passing_evidence().report()).expect("evidence JSON");
    inconsistent["checks"][0]["status"] = Value::String("fail".to_owned());
    inconsistent["checks"][0]["reasonCode"] = Value::String("proof.check_failed".to_owned());
    assert_eq!(
        ValidatedEvidenceReport::parse(
            &serde_json::to_vec(&inconsistent).expect("inconsistent evidence JSON")
        )
        .expect_err("passing report with failed check must fail")
        .code,
        "evidence.schema_invalid"
    );
}
