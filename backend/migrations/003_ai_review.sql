-- Apply with migration credentials before running the API with its runtime role.
CREATE TABLE IF NOT EXISTS novaworks.ai_drafts (
 id TEXT PRIMARY KEY,
 hash TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK (status IN ('extracting','review','approving','approved','failed')),
 token TEXT,
 lease_until BIGINT NOT NULL DEFAULT 0,
 draft_json TEXT,
 issues_json TEXT,
 result_json TEXT
);
