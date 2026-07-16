# `libre-ai-proof`

Evidence Report validation and release/build qualification.

A `QualifiedReleaseCandidate` can only be constructed when artifact bytes match a deterministic
manifest, the Evidence Report is internally consistent and passing, and its subject/reference IDs
and digests bind exactly to that manifest. The wrapper exposes digests and opaque IDs only.
