-- 0003_revisions: snapshots of post/work inputs on every write.
-- Restores write the snapshot through the normal update path, so a
-- restore is itself a revision and stays undoable.

CREATE TABLE IF NOT EXISTS revisions (
	id TEXT PRIMARY KEY,
	entity_type TEXT NOT NULL CHECK (entity_type IN ('post', 'work')),
	entity_id TEXT NOT NULL,
	snapshot_json TEXT NOT NULL,
	actor TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revisions_entity ON revisions (entity_type, entity_id, created_at DESC);
