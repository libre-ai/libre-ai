/**
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiPublicVoteDatasetV2 = {
  schemaVersion: "libre-ai.public-vote-dataset.v2";
  id: string;
  version: string;
  scope: string;
  methodId: string;
  methodDigest: string;
  statements: Array<{
    id: string;
    wording: string;
    source: { uri: string; retrievedAt: string; digest: string; licence: string };
    votesFor: number;
    votesAgainst: number;
    abstentions: number;
    absent: number;
  }>;
  publishedAt: string;
  digest: string;
  approvals: Array<{
    role: "methodological-review" | "legal-privacy-review";
    actorKind: "human";
    reviewerId: string;
    approvedAt: string;
    reference: string;
    subjectDigest: string;
  }> &
    unknown &
    unknown;
};

export type Reviewapproval = {
  role: "methodological-review" | "legal-privacy-review";
  actorKind: "human";
  reviewerId: string;
  approvedAt: string;
  reference: string;
  subjectDigest: string;
};
