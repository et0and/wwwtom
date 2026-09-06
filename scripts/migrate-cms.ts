/**
 * One-off content cutover: copy the proven dev CMS content (already-converted
 * Tiptap rows + R2 bytes) into staging or production. No conversion, no
 * Payload reads — dev is the source of truth.
 *
 * Run: pnpm --filter @tom/simulator migrate:cms -- --target=staging
 * Applies only with --apply (default is dry-run):
 *   pnpm --filter @tom/simulator migrate:cms -- --target=staging --apply
 * Limit docs for a smoke test: --limit=2. Tables: --only=media|posts|works.
 *
 * Prerequisites: the target stage api stack deployed (creates the D1/R2
 * resources and runs migrations), alchemy login for D1 access, and
 * infra/.dev.vars holding the TOM_SECRETS bundle (INTERNAL_API_TOKEN).
 * Auth sessions are never copied; Better Auth tables stay per-stage.
 * Dependency-free (node builtins only) so it runs anywhere with tsx.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type DbValue = string | number | null;
type DbRow = Record<string, DbValue>;

type Args = {
  readonly target: "staging" | "production";
  readonly apply: boolean;
  readonly only: string | undefined;
  readonly limit: number | undefined;
};

const parseArgs = (argv: ReadonlyArray<string>): Args => {
  const get = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    const found = argv.find((arg) => arg.startsWith(prefix));
    return found?.slice(prefix.length);
  };
  const target = get("target");
  if (target !== "staging" && target !== "production") {
    throw new Error("pass --target=staging or --target=production");
  }
  const limit = get("limit");
  return {
    target,
    apply: argv.includes("--apply"),
    only: get("only"),
    limit: limit === undefined ? undefined : Number.parseInt(limit, 10),
  };
};

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const readJsonFile = (path: string): unknown => JSON.parse(readFileSync(path, "utf8")) as unknown;

const loadAuth = () => {
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    return {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
    };
  }
  const profiles = readJsonFile(join(homedir(), ".alchemy", "profiles.json")) as {
    profiles: { default: { Cloudflare: { accountId: string } } };
  };
  const oauth = readJsonFile(
    join(homedir(), ".alchemy", "credentials", "default", "cf-oauth.json"),
  ) as {
    access: string | { access_token: string };
  };
  const access = oauth.access as string | { access_token?: string };
  const token = (access as { access_token?: string }).access_token ?? (access as string);
  return { accountId: profiles.profiles.default.Cloudflare.accountId, token };
};

const internalToken = (): string => {
  const raw = readFileSync(join(rootDir, "infra", ".dev.vars"), "utf8");
  const start = raw.indexOf("{", raw.indexOf("TOM_SECRETS="));
  let depth = 0;
  let end = start;
  for (; end < raw.length; end += 1) {
    if (raw[end] === "{") depth += 1;
    if (raw[end] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const bundle = JSON.parse(raw.slice(start, end + 1)) as { INTERNAL_API_TOKEN?: string };
  if (!bundle.INTERNAL_API_TOKEN)
    throw new Error("INTERNAL_API_TOKEN missing from infra/.dev.vars");
  return bundle.INTERNAL_API_TOKEN;
};

type D1Statement = { readonly sql: string; readonly params?: ReadonlyArray<DbValue> };

type CloudAuth = { readonly accountId: string; readonly token: string };

const d1Fetch = async (
  auth: CloudAuth,
  path: string,
  body: { readonly sql?: string } | ReadonlyArray<D1Statement> | undefined,
): Promise<unknown> => {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${auth.accountId}${path}`,
    body === undefined
      ? { headers: { Authorization: `Bearer ${auth.token}` } }
      : {
          method: "POST",
          headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const parsed = (await response.json()) as {
    success: boolean;
    errors: Array<{ message: string }>;
    result: unknown;
  };
  if (!parsed.success) throw new Error(`D1 request failed: ${JSON.stringify(parsed.errors)}`);
  return parsed.result;
};

const findDatabase = async (
  auth: CloudAuth,
  matches: (name: string) => boolean,
  what: string,
): Promise<string> => {
  const result = (await d1Fetch(auth, "/d1/database", undefined)) as Array<{
    name: string;
    uuid: string;
  }>;
  const found = result.filter((db) => matches(db.name));
  if (found.length !== 1 || !found[0]) {
    throw new Error(`expected exactly one ${what} database, found ${found.length}`);
  }
  return found[0].uuid;
};

const queryAll = async (auth: CloudAuth, db: string, sql: string): Promise<Array<DbRow>> => {
  const result = (await d1Fetch(auth, `/d1/database/${db}/query`, { sql })) as Array<{
    results: Array<DbRow>;
  }>;
  return result[0]?.results ?? [];
};

const batchWrite = async (
  auth: CloudAuth,
  db: string,
  statements: ReadonlyArray<{ sql: string; params: ReadonlyArray<DbValue> }>,
): Promise<void> => {
  for (const statement of statements) {
    await d1Fetch(auth, `/d1/database/${db}/query`, statement);
  }
};

const insertStatement = (table: string, row: DbRow) => {
  const columns = Object.keys(row);
  return {
    sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    params: columns.map((column) => row[column] ?? null),
  };
};

const REVISIONS_DDL =
  "CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL " +
  "CHECK (entity_type IN ('post', 'work')), entity_id TEXT NOT NULL, snapshot_json TEXT NOT NULL, " +
  "actor TEXT, created_at TEXT NOT NULL)";

const REVISIONS_INDEX =
  "CREATE INDEX IF NOT EXISTS idx_revisions_entity ON revisions (entity_type, entity_id, created_at DESC)";

const targetApiBase = (target: Args["target"]): string =>
  target === "production" ? "https://api.tom.so" : "https://staging-api.tom.so";

const copyBytes = async (
  target: Args["target"],
  token: string,
  id: string,
  key: string,
  mime: string,
): Promise<number> => {
  const source = await fetch(`https://dev-api.tom.so/media/${id}/file`);
  if (!source.ok) throw new Error(`dev bytes missing for ${id}: ${source.status}`);
  const bytes = new Uint8Array(await source.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const put = await fetch(`${targetApiBase(target)}/migrate/r2-put`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-token": token },
    body: JSON.stringify({ key, contentType: mime, contentBase64: btoa(binary) }),
  });
  if (!put.ok) throw new Error(`r2-put failed for ${key}: ${put.status}`);
  return bytes.byteLength;
};

const wants = (only: string | undefined, table: string): boolean =>
  only === undefined || only === table;

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  const auth = loadAuth();
  const source = await findDatabase(
    auth,
    (name) => name.includes("cms-d1") && name.includes("dev"),
    "dev source",
  );
  const targetDb =
    args.target === "production"
      ? await findDatabase(auth, (name) => name === "tom-cms", "production target")
      : await findDatabase(
          auth,
          (name) => name.includes("cms-d1") && name.includes("staging"),
          "staging target",
        );

  const sourceMedia = await queryAll(auth, source, "SELECT * FROM media");
  const sourceCategories = await queryAll(auth, source, "SELECT * FROM categories");
  const sourcePosts = await queryAll(auth, source, "SELECT * FROM posts");
  const sourceWorks = await queryAll(auth, source, "SELECT * FROM works");
  const sourceLinks = await queryAll(auth, source, "SELECT * FROM post_categories");
  const sourceRevisions = await queryAll(auth, source, "SELECT * FROM revisions");

  const missingTable = async (table: string): Promise<never> => {
    throw new Error(`target ${table} table missing — deploy the target api stack first`);
  };
  const targetPostSlugs = new Set(
    (
      await queryAll(auth, targetDb, "SELECT slug FROM posts").catch(() => missingTable("posts"))
    ).map((row) => String(row.slug)),
  );
  const targetWorkSlugs = new Set(
    (
      await queryAll(auth, targetDb, "SELECT slug FROM works").catch(() => missingTable("works"))
    ).map((row) => String(row.slug)),
  );
  const targetMediaKeys = new Set(
    (
      await queryAll(auth, targetDb, "SELECT key FROM media").catch(() => missingTable("media"))
    ).map((row) => String(row.key)),
  );
  const targetRevisionIds = new Set(
    (
      await queryAll(auth, targetDb, "SELECT id FROM revisions").catch(() => [] as Array<DbRow>)
    ).map((row) => String(row.id)),
  );
  const targetCategorySlugs = new Set(
    (
      await queryAll(auth, targetDb, "SELECT slug FROM categories").catch(() =>
        missingTable("categories"),
      )
    ).map((row) => String(row.slug)),
  );
  const targetLinkPairs = new Set(
    (
      await queryAll(auth, targetDb, "SELECT post_id, category_id FROM post_categories").catch(() =>
        missingTable("post_categories"),
      )
    ).map((row) => `${row.post_id}/${row.category_id}`),
  );

  let docs = sourcePosts.filter((row) => !targetPostSlugs.has(String(row.slug)));
  let works = sourceWorks.filter((row) => !targetWorkSlugs.has(String(row.slug)));
  if (args.limit !== undefined) {
    docs = docs.slice(0, args.limit);
    works = works.slice(0, args.limit);
  }
  const media = sourceMedia.filter((row) => !targetMediaKeys.has(String(row.key)));
  const revisions = sourceRevisions.filter((row) => !targetRevisionIds.has(String(row.id)));

  const plan: Array<{ table: string; rows: Array<DbRow> }> = [];
  if (wants(args.only, "media")) plan.push({ table: "media", rows: media });
  plan.push({
    table: "categories",
    rows: sourceCategories.filter((row) => !targetCategorySlugs.has(String(row.slug))),
  });
  if (wants(args.only, "posts")) plan.push({ table: "posts", rows: docs });
  if (wants(args.only, "works")) plan.push({ table: "works", rows: works });
  plan.push({
    table: "post_categories",
    rows: sourceLinks.filter((row) => !targetLinkPairs.has(`${row.post_id}/${row.category_id}`)),
  });
  plan.push({ table: "revisions", rows: revisions });

  for (const step of plan) {
    console.log(`${args.apply ? "COPY" : "PLAN"} ${step.table}: ${step.rows.length} rows`);
  }
  console.log(`source media rows: ${sourceMedia.length}, new: ${media.length}`);
  if (!args.apply) {
    console.log("dry-run — pass --apply to write");
    return;
  }

  await d1Fetch(auth, `/d1/database/${targetDb}/query`, { sql: REVISIONS_DDL });
  await d1Fetch(auth, `/d1/database/${targetDb}/query`, { sql: REVISIONS_INDEX });
  for (const step of plan) {
    if (step.rows.length === 0) continue;
    await batchWrite(
      auth,
      targetDb,
      step.rows.map((row) => insertStatement(step.table, row)),
    );
  }

  if (wants(args.only, "media")) {
    const token = internalToken();
    for (const row of sourceMedia) {
      const size = await copyBytes(
        args.target,
        token,
        String(row.id),
        String(row.key),
        String(row.mime),
      );
      console.log(`bytes ${row.key}: ${size}`);
    }
  }
  console.log(`done: ${args.target}`);
};

main().then(
  () => undefined,
  (cause) => {
    console.error(`migration failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exit(1);
  },
);
