/**
 * Infra scan: query Cloudflare request analytics for reconnaissance and
 * probing against our hosts, and print one markdown report.
 *
 * The scheduled security sweep runs this as the single source of truth for
 * what "someone poking at our infra" looks like, so the judgement of which
 * requests are hostile lives in the repo (reviewable, diffable) rather than
 * in a prompt that drifts between runs. The sweep reads the report, decides
 * which findings warrant a change, and opens a PR against `dev`.
 *
 * A finding is a probe pattern with traffic this window. A *soft hit* is a
 * probe that answered 2xx or 3xx — a scanner walking away believing it found
 * something, which is the signal worth acting on first.
 *
 * Dependency-free (node builtins only), like scripts/pr-review.ts, so the
 * sweep runs it with plain node type stripping — no pnpm install. `.mts`
 * rather than `.ts` because this file imports (`pr-review.ts` does not), and
 * a bare `.ts` with imports under a `"type"`-less package.json makes node
 * reparse it as ESM and warn on every run.
 *
 * Run:
 *   node scripts/infra-scan.mts
 *   node scripts/infra-scan.mts --since=6h --json
 *   node scripts/infra-scan.mts --host=tom.so
 *
 * Env:
 *   CLOUDFLARE_API_TOKEN     else infra/.dev.vars, else the local wrangler
 *                            OAuth token (which expires after an hour, so it
 *                            is only a convenience for interactive runs)
 *   CLOUDFLARE_ACCOUNT_ID    else discovered from GET /accounts
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const ACCOUNTS_URL = "https://api.cloudflare.com/client/v4/accounts";
const USER_AGENT = "wwwtom-infra-scan/1.0 (+https://github.com/et0and/wwwtom)";

/** Probe patterns, as SQL `LIKE` matches on the request path. */
const PROBE_PATTERNS = [
  { id: "credentialFiles", label: "credential files (.env)", like: "%.env%" },
  { id: "gitMetadata", label: "git metadata", like: "%.git%" },
  { id: "svnMetadata", label: "svn metadata", like: "%.svn%" },
  { id: "wordpress", label: "WordPress paths", like: "%wp-%" },
  { id: "configFiles", label: "config files", like: "%config%.php%" },
  { id: "dbAdmin", label: "db admin panels", like: "%phpmyadmin%" },
  { id: "dbAdminAlt", label: "db admin (adminer)", like: "%adminer%" },
  { id: "backups", label: "backup files", like: "%backup%" },
  { id: "phpinfo", label: "phpinfo / debug", like: "%phpinfo%" },
  { id: "sshKeys", label: "ssh keys", like: "%id_rsa%" },
  { id: "awsCreds", label: "aws credentials", like: "%aws/credentials%" },
  { id: "iacState", label: "iac state", like: "%tfstate%" },
  { id: "composeFiles", label: "compose files", like: "%docker-compose%" },
  { id: "dsStore", label: "macOS metadata", like: "%.ds_store%" },
  { id: "cmsAdmin", label: "cms admin", like: "%/admin%" },
] as const;

/** The repo's own zones, for the host rollup and soft-hit checks. */
const OWN_HOST_SUFFIXES = ["tom.so", "sophie.st"] as const;

type Args = {
  sinceMs: number;
  host: string | null;
  json: boolean;
};

type Dimensions = {
  clientRequestPath?: string;
  clientRequestHTTPHost?: string;
  edgeResponseStatus?: number;
  userAgent?: string;
  clientIP?: string;
};

type Group = { count: number; dimensions: Dimensions };

type PatternResult = {
  id: string;
  label: string;
  total: number;
  /** Top hosts for this pattern, so the report names where the traffic lands. */
  topHosts: ReadonlyArray<{ host: string; count: number }>;
  /** Probe paths that answered 2xx or 3xx — the actionable hits. */
  softHits: ReadonlyArray<{ host: string; path: string; status: number; count: number }>;
};

type Report = {
  window: string;
  hostFilter: string | null;
  totalRequests: number;
  patterns: ReadonlyArray<PatternResult>;
  topErrorPaths: ReadonlyArray<{ host: string; path: string; status: number; count: number }>;
  topUserAgents: ReadonlyArray<{ userAgent: string; count: number }>;
  topIps: ReadonlyArray<{ ip: string; count: number }>;
};

const HELP = `Usage: node scripts/infra-scan.mts [options]

  --since=<window>   look back 15m/1h/6h/24h/7d (default 24h)
  --host=<host>      restrict to one hostname (e.g. tom.so)
  --json             emit JSON instead of markdown
  --help             show this message
`;

const parseDuration = (raw: string): number | null => {
  const match = /^(\d+)([mhd])$/.exec(raw.trim());
  const value = match?.[1];
  const unit = match?.[2];
  if (value === undefined || unit === undefined) return null;
  const scale = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return Number(value) * scale;
};

const windowLabel = (sinceMs: number): string =>
  sinceMs < 3_600_000
    ? `${sinceMs / 60_000}m`
    : sinceMs < 86_400_000
      ? `${sinceMs / 3_600_000}h`
      : `${sinceMs / 86_400_000}d`;

const parseArgs = (argv: ReadonlyArray<string>): Args | null => {
  const args: Args = { sinceMs: 86_400_000, host: null, json: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(HELP);
      return null;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    const since = /^--since=(.+)$/.exec(arg)?.[1];
    if (since !== undefined) {
      const ms = parseDuration(since);
      if (ms === null) throw new Error(`--since expects 15m/1h/6h/24h/7d, got "${since}"`);
      args.sinceMs = ms;
      continue;
    }
    const host = /^--host=(.+)$/.exec(arg)?.[1];
    if (host !== undefined) {
      args.host = host;
      continue;
    }
    throw new Error(`unknown argument "${arg}" (try --help)`);
  }
  return args;
};

/**
 * The local wrangler OAuth token. Reading it here is what lets the sweep run
 * with no new credential: the machine is already logged in for deploys.
 * macOS keeps it under Preferences; other platforms under the config dir.
 */
const readWranglerToken = async (): Promise<string | null> => {
  const candidates = [
    join(homedir(), "Library", "Preferences", ".wrangler", "config", "default.toml"),
    join(homedir(), ".wrangler", "config", "default.toml"),
    join(
      process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
      ".wrangler",
      "config",
      "default.toml",
    ),
  ];
  for (const path of candidates) {
    const contents = await readFile(path, "utf8").catch(() => null);
    const token =
      contents === null ? undefined : /^\s*oauth_token\s*=\s*"([^"]+)"/m.exec(contents)?.[1];
    if (token !== undefined) return token;
  }
  return null;
};

/**
 * `CLOUDFLARE_API_TOKEN` from the repo's deploy env file.
 *
 * The wrangler OAuth token below is not usable unattended: it expires after
 * an hour and only wrangler refreshes it, so a sweep that runs every three
 * hours would fail almost every time. An API token lives until revoked, and
 * the deploy env file is where this repo already keeps the deploy credential.
 */
const readDevVarsToken = async (): Promise<string | null> => {
  const candidates = [join(process.cwd(), "infra", ".dev.vars"), join(process.cwd(), ".dev.vars")];
  for (const path of candidates) {
    const contents = await readFile(path, "utf8").catch(() => null);
    if (contents === null) continue;
    for (const line of contents.split("\n")) {
      const value = /^\s*CLOUDFLARE_API_TOKEN\s*=\s*(.*)$/.exec(line)?.[1];
      if (value === undefined) continue;
      const unquoted = value.trim().replace(/^["']|["']$/g, "");
      if (unquoted) return unquoted;
    }
  }
  return null;
};

type TokenSource = "env" | "dev.vars" | "wrangler";

type ResolvedToken = { readonly token: string; readonly source: TokenSource };

const resolveToken = async (): Promise<ResolvedToken> => {
  const fromEnv = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CF_API_TOKEN;
  if (fromEnv) return { token: fromEnv, source: "env" };
  const fromDevVars = await readDevVarsToken();
  if (fromDevVars) return { token: fromDevVars, source: "dev.vars" };
  const fromWrangler = await readWranglerToken();
  if (fromWrangler) return { token: fromWrangler, source: "wrangler" };
  throw new Error(
    "no Cloudflare token: set CLOUDFLARE_API_TOKEN (or put it in infra/.dev.vars), or run `wrangler login`",
  );
};

// A declaration rather than a generic arrow: `.mts` reserves `<T>` in arrow
// position (it parses as JSX), so `<T,>` or a declaration are the fixes.
async function request<T>(url: string, token: string, graphql?: string): Promise<T> {
  const headers = { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT };
  const init: RequestInit =
    graphql === undefined
      ? { method: "GET", headers }
      : {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ query: graphql }),
        };
  const response = await fetch(url, init);
  const body = (await response.json()) as T;
  if (!response.ok) throw new Error(`${url} responded ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

const resolveAccountId = async ({ token, source }: ResolvedToken): Promise<string> => {
  const fromEnv = process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID;
  if (fromEnv) return fromEnv;
  const body = await request<{ result?: ReadonlyArray<{ id: string }> }>(ACCOUNTS_URL, token).catch(
    (cause) => {
      if (source !== "wrangler") throw cause;
      // The common unattended failure: wrangler's OAuth access token is an
      // hour old and only wrangler can refresh it.
      throw new Error(
        "the wrangler OAuth token was rejected. It expires after an hour and only wrangler refreshes it, so an unattended scan cannot rely on it — set CLOUDFLARE_API_TOKEN in the environment or in infra/.dev.vars.",
      );
    },
  );
  const account = body.result?.[0];
  if (!account) throw new Error("the token can read no accounts; set CLOUDFLARE_ACCOUNT_ID");
  return account.id;
};

/**
 * One request holds every pattern's rollup via GraphQL aliases — the sweep
 * runs every 3 hours, so it should not fan out to dozens of round trips.
 */
const buildQuery = (args: Args, sinceIso: string): string => {
  const hostFilter = args.host === null ? "" : `, clientRequestHTTPHost: "${args.host}"`;
  const window = `datetime_geq: "${sinceIso}"${hostFilter}`;
  const patternFields = PROBE_PATTERNS.map(
    (pattern) => `
      ${pattern.id}_total: httpRequestsAdaptiveGroups(limit: 1, filter: { ${window}, clientRequestPath_like: "${pattern.like}" }) { count }
      ${pattern.id}_hosts: httpRequestsAdaptiveGroups(limit: 10, filter: { ${window}, clientRequestPath_like: "${pattern.like}" }, orderBy: [count_DESC]) { count dimensions { clientRequestHTTPHost } }
      ${pattern.id}_paths: httpRequestsAdaptiveGroups(limit: 15, filter: { ${window}, clientRequestPath_like: "${pattern.like}" }, orderBy: [count_DESC]) { count dimensions { clientRequestHTTPHost clientRequestPath edgeResponseStatus } }`,
  ).join("\n");

  return `query ScanInfra {
    viewer {
      accounts(filter: { accountTag: "ACCOUNT_ID" }) {
        total: httpRequestsAdaptiveGroups(limit: 1, filter: { ${window} }) { count }
        errors: httpRequestsAdaptiveGroups(limit: 15, filter: { ${window}, edgeResponseStatus_geq: 400 }, orderBy: [count_DESC]) { count dimensions { clientRequestHTTPHost clientRequestPath edgeResponseStatus } }
        agents: httpRequestsAdaptiveGroups(limit: 15, filter: { ${window} }, orderBy: [count_DESC]) { count dimensions { userAgent } }
        ips: httpRequestsAdaptiveGroups(limit: 15, filter: { ${window} }, orderBy: [count_DESC]) { count dimensions { clientIP } }
${patternFields}
      }
    }
  }`;
};

const isOwnHost = (host: string): boolean =>
  OWN_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));

const collect = (
  account: Readonly<Record<string, ReadonlyArray<Group>>>,
  args: Args,
  window: string,
): Report => {
  const first = (key: string): ReadonlyArray<Group> => account[key] ?? [];

  const patterns = PROBE_PATTERNS.map((pattern): PatternResult => {
    const total = first(`${pattern.id}_total`)[0]?.count ?? 0;
    const topHosts = first(`${pattern.id}_hosts`)
      .map((group) => ({ host: group.dimensions.clientRequestHTTPHost ?? "?", count: group.count }))
      .filter((entry) => isOwnHost(entry.host));
    const softHits = first(`${pattern.id}_paths`)
      .flatMap((group) => {
        const status = group.dimensions.edgeResponseStatus ?? 0;
        const host = group.dimensions.clientRequestHTTPHost ?? "?";
        const path = group.dimensions.clientRequestPath ?? "?";
        // Only our hosts, and only answers a scanner reads as success.
        if (status < 200 || status >= 400 || !isOwnHost(host)) return [];
        return [{ host, path, status, count: group.count }];
      })
      .sort((a, b) => b.count - a.count);
    return { id: pattern.id, label: pattern.label, total, topHosts, softHits };
  });

  return {
    window,
    hostFilter: args.host,
    totalRequests: first("total")[0]?.count ?? 0,
    patterns,
    topErrorPaths: first("errors").map((group) => ({
      host: group.dimensions.clientRequestHTTPHost ?? "?",
      path: group.dimensions.clientRequestPath ?? "?",
      status: group.dimensions.edgeResponseStatus ?? 0,
      count: group.count,
    })),
    topUserAgents: first("agents").map((group) => ({
      userAgent: group.dimensions.userAgent ?? "(empty)",
      count: group.count,
    })),
    topIps: first("ips").map((group) => ({
      ip: group.dimensions.clientIP ?? "?",
      count: group.count,
    })),
  };
};

const count = (value: number): string => value.toLocaleString("en-US");

const renderMarkdown = (report: Report): string => {
  const withTraffic = report.patterns.filter((pattern) => pattern.total > 0);
  const softHits = withTraffic.flatMap((pattern) =>
    pattern.softHits.map((hit) => ({ ...hit, label: pattern.label })),
  );
  const probed = withTraffic.reduce((sum, pattern) => sum + pattern.total, 0);
  const share = report.totalRequests === 0 ? 0 : Math.round((probed / report.totalRequests) * 100);

  const lines = [
    `# Infra scan — last ${report.window}`,
    "",
    `Requests: **${count(report.totalRequests)}** · probe-pattern matches: **${count(probed)}** (${share}%)${report.hostFilter === null ? "" : ` · host \`${report.hostFilter}\``}`,
    "",
    "## Soft hits (probes that answered 2xx/3xx)",
    "",
  ];

  if (softHits.length === 0) {
    lines.push("None — every probe was answered with an error or redirect.", "");
  } else {
    lines.push("A scanner reads these as a find. This list is the actionable one.", "");
    lines.push("| Count | Status | Host | Path | Pattern |");
    lines.push("| ---: | ---: | --- | --- | --- |");
    for (const hit of softHits.slice(0, 25)) {
      lines.push(
        `| ${count(hit.count)} | ${hit.status} | \`${hit.host}\` | \`${hit.path}\` | ${hit.label} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Probe patterns", "");
  if (withTraffic.length === 0) {
    lines.push("No probe-pattern traffic this window.", "");
  } else {
    lines.push("| Pattern | Requests | Top host |");
    lines.push("| --- | ---: | --- |");
    for (const pattern of [...withTraffic].sort((a, b) => b.total - a.total)) {
      const top = pattern.topHosts[0];
      lines.push(
        `| ${pattern.label} | ${count(pattern.total)} | ${top === undefined ? "—" : `\`${top.host}\` (${count(top.count)})`} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Top error paths", "");
  lines.push("| Count | Status | Host | Path |");
  lines.push("| ---: | ---: | --- | --- |");
  for (const entry of report.topErrorPaths.slice(0, 15)) {
    lines.push(
      `| ${count(entry.count)} | ${entry.status} | \`${entry.host}\` | \`${entry.path}\` |`,
    );
  }
  lines.push("");

  lines.push("## Callers", "");
  lines.push("| Count | User agent |");
  lines.push("| ---: | --- |");
  for (const entry of report.topUserAgents.slice(0, 10)) {
    lines.push(`| ${count(entry.count)} | \`${entry.userAgent.slice(0, 100)}\` |`);
  }
  lines.push("");
  lines.push("| Count | Client IP |");
  lines.push("| ---: | --- |");
  for (const entry of report.topIps.slice(0, 10)) {
    lines.push(`| ${count(entry.count)} | \`${entry.ip}\` |`);
  }
  lines.push("");

  return lines.join("\n");
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  if (args === null) return;

  const sinceIso = new Date(Date.now() - args.sinceMs).toISOString();
  const resolved = await resolveToken();
  const accountId = await resolveAccountId(resolved);
  const query = buildQuery(args, sinceIso).replace("ACCOUNT_ID", accountId);

  const body = await request<{
    data?: { viewer: { accounts: ReadonlyArray<Readonly<Record<string, ReadonlyArray<Group>>>> } };
    // GraphQL answers with `errors: null` on success, so null is a real case.
    errors?: ReadonlyArray<{ message: string }> | null;
  }>(GRAPHQL_URL, resolved.token, query);

  if (body.errors !== undefined && body.errors !== null && body.errors.length > 0) {
    throw new Error(
      `analytics query failed: ${body.errors.map((error) => error.message).join("; ")}`,
    );
  }

  const account = body.data?.viewer.accounts[0];
  if (account === undefined) {
    throw new Error("analytics query returned no account — check the account id and token scope");
  }

  const report = collect(account, args, windowLabel(args.sinceMs));
  console.log(args.json ? JSON.stringify(report, null, 2) : renderMarkdown(report));
};

main().then(
  () => undefined,
  (cause) => {
    console.error(`infra-scan failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    process.exit(1);
  },
);
