# Notebook

- **Path:** `apps/notebook`
- **Purpose:** private local-first notes with explicit context sharing.
- **Runtime:** Bun/React PWA; offline-first.
- **Owns:** blocks, links, local indexes, selection and context exports.
- **Rust candidate:** encryption, deterministic indexing or native-shared core only if required.
- **Critical gates:** private by default, exact export preview, excluded-block proof, backup/restore, conflict model before sync.
