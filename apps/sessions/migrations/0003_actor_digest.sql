-- Indexed opaque actor digest on the session event log (rgpd-kit follow-up,
-- TODO(rgpd-scale) of the first increment). The RGPD read paths resolve a
-- subject digest to its rows; without this column every request scans and
-- hashes O(distinct human actors). The digest is computed at append time by
-- the store (same domain-separated, tenant-scoped sha-256 as
-- @libre-ai/rgpd-kit deriveSubjectDigest), so the lookup becomes one indexed
-- equality. Structural floor: a human event MUST carry its digest — the
-- append path cannot silently skip it — while provider/system actors are not
-- data subjects and carry none. The column stores only the opaque digest,
-- never an alternate plaintext identifier.

ALTER TABLE session_events
  ADD COLUMN actor_digest text
    CONSTRAINT session_events_actor_digest_format CHECK (
      actor_digest IS NULL OR actor_digest ~ '^[a-f0-9]{64}$'
    ),
  ADD CONSTRAINT session_events_human_actor_digest CHECK (
    actor_kind <> 'human' OR actor_digest IS NOT NULL
  );

CREATE INDEX session_events_actor_digest
  ON session_events (tenant_id, actor_digest)
  WHERE actor_digest IS NOT NULL;
