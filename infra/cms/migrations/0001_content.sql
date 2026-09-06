-- 0001_content: tables for the slim Tiptap CMS (posts, works, media, categories).
-- Better Auth tables arrive in 0002_auth with the GitHub OAuth step.

CREATE TABLE IF NOT EXISTS categories (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media (
	id TEXT PRIMARY KEY,
	key TEXT NOT NULL UNIQUE,
	mime TEXT NOT NULL,
	width INTEGER,
	height INTEGER,
	alt TEXT,
	caption TEXT,
	variants_json TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL,
	summary TEXT,
	content_json TEXT NOT NULL,
	html TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
	published_at TEXT,
	hero_media_id TEXT REFERENCES media (id),
	meta_title TEXT,
	meta_description TEXT,
	meta_image TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS post_categories (
	post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
	category_id TEXT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
	PRIMARY KEY (post_id, category_id)
);

CREATE TABLE IF NOT EXISTS works (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL,
	summary TEXT,
	content_json TEXT NOT NULL,
	html TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
	published_at TEXT,
	hero_media_id TEXT REFERENCES media (id),
	meta_title TEXT,
	meta_description TEXT,
	meta_image TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_status_published ON posts (status, published_at);
CREATE INDEX IF NOT EXISTS idx_works_status_published ON works (status, published_at);
