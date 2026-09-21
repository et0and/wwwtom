/**
 * Classifier PR triage: sort a pull request's changed files by how much
 * human review attention each one needs, using the keyless classifier.dev
 * API (see .agents/skills/bulk-classify), then upsert one sticky comment
 * on the PR. The comment is a routing aid — it points reviewers at the
 * files that matter and leaves the review itself to a human.
 *
 * Dependency-free (node builtins only) so the workflow runs it with plain
 * node 24 type stripping — no pnpm install.
 *
 * Run:
 *   node scripts/pr-review.ts --repo=et0and/wwwtom --pr=123
 *   node scripts/pr-review.ts --repo=et0and/wwwtom --pr=123 --dry-run
 *   node scripts/pr-review.ts --demo   # classify fixtures, print the comment
 *
 * Env: GH_TOKEN (or GITHUB_TOKEN) with pull-requests: write.
 */

const USER_AGENT = "wwwtom-pr-review/1.0 (+https://github.com/et0and/wwwtom)";
const CLASSIFIER_URL = "https://classifier.dev";
const COMMENT_MARKER = "<!-- classifier-pr-review -->";
const CONFIDENCE_FLOOR = 0.8;
// classifier.dev takes up to 20 inputs per request; larger batches 502
// with `batch_unavailable`.
const BATCH_SIZE = 20;
// Page cap for both list endpoints (100 items a page; 10 pages is plenty).
const MAX_PAGES = 10;
const MAX_LISTED = 200;
const COLLAPSE_AFTER = 12;
const PATCH_EXCERPT_CHARS = 1200;
const PATCH_EXCERPT_LINES = 30;
const MAX_ATTEMPTS = 3;

const REVIEW_LABELS = [
  "needs careful review",
  "routine change",
  "mechanical or low risk",
  "generated or dependency change",
] as const;

const FOCUS_LABEL = REVIEW_LABELS[0];

const SECTION_ORDER: ReadonlyArray<string> = REVIEW_LABELS;

const REVIEW_INSTRUCTIONS = [
  "Judge how much human review attention the changed file needs.",
  "Authentication, payments, database migrations, infrastructure, CI, and",
  "security-sensitive code needs careful review. Documentation, comments,",
  "test-only, and formatting changes are mechanical or low risk. Lockfiles,",
  "snapshots, and generated files are generated or dependency changes.",
  "When in doubt, choose needs careful review.",
].join(" ");

type FileChange = {
  readonly path: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly patch: string | undefined;
};

type ClassifierResult = {
  readonly label: string;
  readonly confidence: number | null;
};

type TriagedFile = {
  readonly file: FileChange;
  readonly group: string;
  readonly confidence: number | null;
  readonly isUnsure: boolean;
};

type Args = {
  readonly repo: string | undefined;
  readonly pr: number | undefined;
  readonly demo: boolean;
  readonly dryRun: boolean;
};

type GitHubFile = {
  readonly filename: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly patch?: string | null;
};

type GitHubComment = {
  readonly id: number;
  readonly body?: string | null;
};

const parseArgs = (argv: ReadonlyArray<string>): Args => {
  const readFlag = (name: string): string | undefined =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const pr = readFlag("pr");
  return {
    repo: readFlag("repo"),
    pr: pr === undefined ? undefined : Number.parseInt(pr, 10),
    demo: argv.includes("--demo"),
    dryRun: argv.includes("--dry-run"),
  };
};

const githubRequest = (path: string, token: string, init: RequestInit): Promise<Response> =>
  fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": USER_AGENT,
      "x-github-api-version": "2022-11-28",
    },
  });

const githubJson = async <T>(path: string, token: string): Promise<T> => {
  const response = await githubRequest(path, token, { method: "GET" });
  if (!response.ok) {
    throw new Error(`github ${path} failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
};

const fetchChangedFiles = async (
  repo: string,
  pr: number,
  token: string,
): Promise<ReadonlyArray<FileChange>> => {
  const collected: Array<FileChange> = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const files = await githubJson<ReadonlyArray<GitHubFile>>(
      `/repos/${repo}/pulls/${pr}/files?per_page=100&page=${page}`,
      token,
    );
    for (const file of files) {
      collected.push({
        path: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch ?? undefined,
      });
    }
    if (files.length < 100) break;
  }
  return collected;
};

const excerpt = (patch: string): string => {
  const lines = patch.split("\n").slice(0, PATCH_EXCERPT_LINES).join("\n");
  return lines.length > PATCH_EXCERPT_CHARS ? lines.slice(0, PATCH_EXCERPT_CHARS) : lines;
};

const buildInput = (file: FileChange): string => {
  const header = `${file.path} (${file.status}, +${file.additions} -${file.deletions})`;
  return file.patch === undefined ? header : `${header}\n${excerpt(file.patch)}`;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const retryDelay = (response: Response, attempt: number): number => {
  const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
  return Number.isNaN(retryAfter) ? attempt * 1000 : retryAfter * 1000;
};

/** Unscored inputs land in the careful-review group: the comment is a routing
 * aid, so an unavailable classifier must widen attention, never fail the run. */
const unscored = (inputs: ReadonlyArray<string>): ReadonlyArray<ClassifierResult> =>
  inputs.map(() => ({ label: FOCUS_LABEL, confidence: null }));

const classifyBatch = async (
  inputs: ReadonlyArray<string>,
): Promise<ReadonlyArray<ClassifierResult>> => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(CLASSIFIER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": USER_AGENT,
      },
      body: JSON.stringify({
        labels: REVIEW_LABELS,
        inputs,
        instructions: REVIEW_INSTRUCTIONS,
        tier: "fast",
      }),
    });
    if (response.ok) {
      const body = (await response.json()) as {
        readonly results: ReadonlyArray<ClassifierResult>;
      };
      if (body.results.length !== inputs.length) {
        throw new Error(
          `classifier.dev returned ${body.results.length} results for ${inputs.length} inputs`,
        );
      }
      return body.results;
    }
    const detail = `classifier.dev ${response.status}: ${await response.text()}`;
    // 4xx means the request itself is wrong; that is ours to fix.
    if (response.status !== 429 && response.status < 500) throw new Error(detail);
    if (attempt === MAX_ATTEMPTS) {
      console.warn(`${detail} — leaving ${inputs.length} files unscored`);
      return unscored(inputs);
    }
    await sleep(retryDelay(response, attempt));
  }
  return unscored(inputs);
};

const chunk = <T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> => {
  const chunks: Array<ReadonlyArray<T>> = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const classify = async (
  inputs: ReadonlyArray<string>,
): Promise<ReadonlyArray<ClassifierResult>> => {
  const results: Array<ClassifierResult> = [];
  for (const batch of chunk(inputs, BATCH_SIZE)) {
    results.push(...(await classifyBatch(batch)));
  }
  return results;
};

const triage = (
  files: ReadonlyArray<FileChange>,
  results: ReadonlyArray<ClassifierResult>,
): ReadonlyArray<TriagedFile> => {
  const triaged: Array<TriagedFile> = [];
  for (const [index, file] of files.entries()) {
    const result = results[index];
    if (result === undefined) {
      throw new Error(`missing classification for ${file.path}`);
    }
    const isUnsure = result.confidence === null || result.confidence < CONFIDENCE_FLOOR;
    triaged.push({
      file,
      group: isUnsure ? FOCUS_LABEL : result.label,
      confidence: result.confidence,
      isUnsure,
    });
  }
  return triaged;
};

const formatConfidence = (confidence: number | null): string =>
  confidence === null ? "unscored" : `${Math.round(confidence * 100)}%`;

const renderEntry = (item: TriagedFile): string => {
  const confidence = `${formatConfidence(item.confidence)}${item.isUnsure ? " (unsure)" : ""}`;
  return `- \`${item.file.path}\` — ${confidence} — +${item.file.additions} -${item.file.deletions}`;
};

const renderSection = (heading: string, items: ReadonlyArray<TriagedFile>): string => {
  if (items.length === 0) return "";
  const lines = items.map(renderEntry).join("\n");
  const body =
    items.length > COLLAPSE_AFTER
      ? `<details>\n<summary>${items.length} files</summary>\n\n${lines}\n\n</details>`
      : lines;
  return `### ${heading} (${items.length})\n\n${body}`;
};

const renderComment = (
  files: ReadonlyArray<FileChange>,
  results: ReadonlyArray<ClassifierResult>,
): string => {
  const triaged = triage(files, results);
  const shown = triaged.slice(0, MAX_LISTED);
  const hidden = triaged.length - shown.length;
  const focusCount = triaged.filter((item) => item.group === FOCUS_LABEL).length;
  const sections = SECTION_ORDER.map((label) =>
    renderSection(
      label,
      shown.filter((item) => item.group === label),
    ),
  ).filter((section) => section.length > 0);
  const header = [
    COMMENT_MARKER,
    "",
    "## Automated review triage",
    "",
    `${triaged.length} changed file${triaged.length === 1 ? "" : "s"} sorted with [classifier.dev](https://classifier.dev)` +
      `: **${focusCount} need careful review**. Paths and diff excerpts go to` +
      " that API for classification only.",
    "",
  ].join("\n");
  const notes = [
    `Answers under ${Math.round(CONFIDENCE_FLOOR * 100)}% confidence (or unscored) are treated as **${FOCUS_LABEL}** rather than trusted.`,
  ];
  if (hidden > 0) {
    notes.push(`${hidden} more file${hidden === 1 ? "" : "s"} omitted.`);
  }
  const footer = [
    "",
    "---",
    "",
    `_${notes.join(" ")} This triage routes attention; it does not replace review._`,
  ].join("\n");
  return `${header}\n${sections.join("\n\n")}\n${footer}\n`;
};

const findStickyComment = async (
  repo: string,
  pr: number,
  token: string,
): Promise<number | undefined> => {
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const comments = await githubJson<ReadonlyArray<GitHubComment>>(
      `/repos/${repo}/issues/${pr}/comments?per_page=100&page=${page}`,
      token,
    );
    const found = comments.find((comment) => (comment.body ?? "").includes(COMMENT_MARKER));
    if (found !== undefined) return found.id;
    if (comments.length < 100) return undefined;
  }
  return undefined;
};

const upsertComment = async (
  repo: string,
  pr: number,
  token: string,
  body: string,
): Promise<void> => {
  const existing = await findStickyComment(repo, pr, token);
  const response =
    existing === undefined
      ? await githubRequest(`/repos/${repo}/issues/${pr}/comments`, token, {
          method: "POST",
          body: JSON.stringify({ body }),
        })
      : await githubRequest(`/repos/${repo}/issues/comments/${existing}`, token, {
          method: "PATCH",
          body: JSON.stringify({ body }),
        });
  if (!response.ok) {
    throw new Error(`github comment upsert failed: ${response.status} ${await response.text()}`);
  }
};

const demoFiles: ReadonlyArray<FileChange> = [
  {
    path: "apps/api/src/routes/guestbook.ts",
    status: "modified",
    additions: 58,
    deletions: 12,
    patch: [
      "@@ -41,9 +41,31 @@ export const guestbook = new Elysia()",
      '-  .post("/guestbook", async ({ body }) => createEntry(body))',
      '+  .post("/guestbook", async ({ body, request }) => {',
      "+    const token = await verifyTurnstile(request, body.token)",
      "+    const handle = await claimHandle(body.handle)",
      "+    return createEntry({ ...body, handle, verified: true })",
      "+  })",
    ].join("\n"),
  },
  {
    path: "packages/types/src/db.ts",
    status: "modified",
    additions: 210,
    deletions: 198,
    patch: [
      "/** Generated by packages/db — do not edit. */",
      "-export type Posts = { id: string; title: string }",
      "+export type Posts = { id: string; title: string; publishedAt: Date }",
    ].join("\n"),
  },
  {
    path: "pnpm-lock.yaml",
    status: "modified",
    additions: 812,
    deletions: 431,
    patch: undefined,
  },
  {
    path: "apps/web/src/components/__tests__/Nav.test.tsx",
    status: "modified",
    additions: 14,
    deletions: 2,
    patch: [
      '@@ -18,6 +18,18 @@ describe("Nav", () => {',
      '+  it("closes the menu on navigation", async () => {',
      "+    const { getByRole } = render(() => <Nav />)",
      '+    await fireEvent.click(getByRole("button"))',
      '+    expect(getByRole("menu")).not.toBeVisible()',
      "+  })",
    ].join("\n"),
  },
  {
    path: "docs/medley-notes.md",
    status: "added",
    additions: 26,
    deletions: 0,
    patch: "+# Notes\n+\n+Scratch notes for the medley work.",
  },
];

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  if (args.demo) {
    const comment = renderComment(demoFiles, await classify(demoFiles.map(buildInput)));
    console.log(comment);
    return;
  }
  if (args.repo === undefined || args.pr === undefined || Number.isNaN(args.pr)) {
    throw new Error("pass --repo=owner/name and --pr=<number> (or --demo)");
  }
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (token === undefined) {
    throw new Error("set GH_TOKEN or GITHUB_TOKEN");
  }
  const files = await fetchChangedFiles(args.repo, args.pr, token);
  if (files.length === 0) {
    console.log(`pr #${args.pr}: no changed files; nothing to triage`);
    return;
  }
  const comment = renderComment(files, await classify(files.map(buildInput)));
  if (args.dryRun) {
    console.log(comment);
    return;
  }
  await upsertComment(args.repo, args.pr, token, comment);
  console.log(`pr #${args.pr}: triaged ${files.length} changed files`);
};

main().then(
  () => undefined,
  (cause) => {
    console.error(`pr-review failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exit(1);
  },
);
