use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

const MANIFEST: &str = "VENDOR-MANIFEST.sha256";

#[test]
fn vendored_biscuit_source_matches_reviewed_manifest() {
    let vendor =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../toolchains/vendor/biscuit-auth");
    let expected = fs::read_to_string(vendor.join(MANIFEST)).unwrap();
    let expected = expected
        .lines()
        .map(|line| {
            let (hash, path) = line
                .split_once("  ")
                .unwrap_or_else(|| panic!("invalid vendor manifest line: {line}"));
            (path.to_owned(), hash.to_owned())
        })
        .collect::<BTreeMap<_, _>>();

    let mut paths = Vec::new();
    collect_files(&vendor, &vendor, &mut paths);
    let mut actual_paths = paths
        .iter()
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .collect::<Vec<_>>();
    actual_paths.sort();
    assert_eq!(
        actual_paths,
        expected.keys().cloned().collect::<Vec<_>>(),
        "vendored file set changed"
    );

    for path in paths {
        let relative = path.to_string_lossy().replace('\\', "/");
        let bytes = fs::read(vendor.join(&path)).unwrap();
        let actual = hex_lower(&Sha256::digest(bytes));
        assert_eq!(
            actual, expected[&relative],
            "vendored file changed: {relative}"
        );
    }
}

fn collect_files(root: &Path, directory: &Path, files: &mut Vec<PathBuf>) {
    for entry in fs::read_dir(directory).unwrap() {
        let entry = entry.unwrap();
        let file_type = entry.file_type().unwrap();
        assert!(!file_type.is_symlink(), "vendor symlinks are forbidden");
        if file_type.is_dir() {
            collect_files(root, &entry.path(), files);
        } else {
            let relative = entry.path().strip_prefix(root).unwrap().to_path_buf();
            if relative != Path::new(MANIFEST) {
                files.push(relative);
            }
        }
    }
    files.sort();
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write;
        write!(&mut output, "{byte:02x}").unwrap();
    }
    output
}
