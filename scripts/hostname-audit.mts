/**
 * Hostname audit: work out which hostnames answer for a zone, and which of
 * them answer *only* because of a wildcard DNS record.
 *
 * A wildcard (`*.tom.so`) makes every guessed hostname resolve, so a scanner
 * sweeping `cars.tom.so`, `jira.tom.so`, `wiki.tom.so` gets a response from
 * the zone for all of them even though none of those hosts exists. That is
 * free reach for probing: each name looks like a live target.
 *
 * This prints the evidence needed to narrow the wildcard safely — every
 * hostname that still needs to answer, and what provides it (a Worker custom
 * domain or an explicit DNS record) — plus the hostnames that are answering
 * with nothing behind them.
 *
 * Dependency-free (node builtins only), like scripts/infra-scan.mts.
 *
 * Run:
 *   node scripts/hostname-audit.mts
 *   node scripts/hostname-audit.mts --since=7d --json
 *
 * Env:
 *   CLOUDFLARE_API_TOKEN     else the local wrangler OAuth token
 *   CLOUDFLARE_ACCOUNT_ID    else discovered from GET /accounts
 *
 * Needs `DNS: Read` to list records. Without it the audit still lists Worker
 * custom domains and observed hostnames, and says so, because the observation
 * half alone is enough to see what traffic the wildcard is catching.
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://api.cloudflare.com/client/v4";
const GRAPHQL_URL = `${API}/graphql`;
const USER_AGENT = "wwwtom-hostname-audit/1.0 (+https://github.com/et0and/wwwtom)";

/** Zones this repo owns. */
const ZONES = [
  { name: "tom.so", zoneId: "d431d14124866e4d3fff6cdd5b727926" },
  { name: "sophie.st", zoneId: "f9fdf74d0ac40a9cc01dc4c8cfa5af6a" },
] as const;

type Args = { sinceMs: number; json: boolean };

type ZoneReport = {
  zone: string;
  wildcardRecords: ReadonlyArray<string>;
  /** Hostnames with a Worker custom domain: these must keep answering. */
  workerHosts: ReadonlyArray<{ hostname: string; service: string }>;
  explicitRecords: ReadonlyArray<string>;
  /** Hostnames seen in traffic that nothing is explicitly serving. */
  wildcardOnlyHosts: ReadonlyArray<{ hostname: string; requests: number }>;
  dnsReadable: boolean;
};

const HELP = `Usage: node scripts/hostname-audit.mts [options]

  --since=<window>    traffic lookback: 1h/6h/24h/7d (default 7d)
  --json              emit JSON instead of markdown
  --help              show this message
`;

const parseDuration = (raw: string): number | null => {
  const match = /^(\d+)([mhd])$/.exec(raw.trim());
  const value = match?.[1];
  const unit = match?.[2];
  if (value === undefined || unit === undefined) return null;
  const scale = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return Number(value) * scale;
};

const parseArgs = (argv: ReadonlyArray<string>): Args | null => {
  const args: Args = { sinceMs: 7 * 86_400_000, json: false };
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
      if (ms === null) throw new Error(`--since expects 1h/6h/24h/7d, got "${since}"`);
      args.sinceMs = ms;
      continue;
    }
    throw new Error(`unknown argument "${arg}" (try --help)`);
  }
  return args;
};

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

const resolveToken = async (): Promise<string> => {
  const fromEnv = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CF_API_TOKEN;
  if (fromEnv) return fromEnv;
  const fromWrangler = await readWranglerToken();
  if (fromWrangler) return fromWrangler;
  throw new Error(
    "no Cloudflare token: set CLOUDFLARE_API_TOKEN, or run `wrangler login` on this machine",
  );
};

type ApiEnvelope<T> = { success: boolean; result?: T; errors?: ReadonlyArray<{ message: string }> };

// A declaration rather than a generic arrow: `.mts` reserves `<T>` in arrow
// position (it parses as JSX), so `<T,>` or a declaration are the fixes.
async function api<T>(url: string, token: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT },
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  // A missing permission is an expected state here, not a failure: the audit
  // is still useful without DNS records.
  if (!body.success) return null;
  return body.result ?? null;
}

const resolveAccountId = async (token: string): Promise<string> => {
  const fromEnv = process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID;
  if (fromEnv) return fromEnv;
  const accounts = await api<ReadonlyArray<{ id: string }>>(`${API}/accounts`, token);
  const account = accounts?.[0];
  if (!account) throw new Error("the token can read no accounts; set CLOUDFLARE_ACCOUNT_ID");
  return account.id;
};

type HostGroup = { count: number; dimensions: { clientRequestHTTPHost?: string } };

/**
 * Hostnames seen in request analytics, aggregated per zone. This is the
 * observation half of the audit: whatever the DNS says, these are the names
 * that actually received traffic.
 */
const observedHosts = async (
  zone: string,
  token: string,
  accountId: string,
  sinceIso: string,
): Promise<ReadonlyArray<{ hostname: string; requests: number }>> => {
  const query = `query AuditHosts {
    viewer {
      accounts(filter: { accountTag: "${accountId}" }) {
        httpRequestsAdaptiveGroups(limit: 100, filter: { datetime_geq: "${sinceIso}", clientRequestHTTPHost_like: "%.${zone}" }, orderBy: [count_DESC]) {
          count
          dimensions { clientRequestHTTPHost }
        }
      }
    }
  }`;
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const body = (await response.json()) as {
    data?: {
      viewer: {
        accounts: ReadonlyArray<{ httpRequestsAdaptiveGroups?: ReadonlyArray<HostGroup> }>;
      };
    };
  };
  const groups = body.data?.viewer.accounts[0]?.httpRequestsAdaptiveGroups ?? [];
  return groups.map((group) => ({
    hostname: group.dimensions.clientRequestHTTPHost ?? "?",
    requests: group.count,
  }));
};

const auditZone = async (
  zone: (typeof ZONES)[number],
  token: string,
  accountId: string,
  sinceIso: string,
  workerHosts: ReadonlyArray<{ hostname: string; service: string }>,
): Promise<ZoneReport> => {
  const records = await api<ReadonlyArray<{ name: string; type: string; proxied?: boolean }>>(
    `${API}/zones/${zone.zoneId}/dns_records?per_page=200`,
    token,
  );

  const servedNames = new Set(
    workerHosts.filter((host) => host.hostname.endsWith(zone.name)).map((host) => host.hostname),
  );
  const explicitRecords = (records ?? [])
    .map((record) => record.name)
    .filter((name) => !name.startsWith("*"));
  const wildcardRecords = (records ?? [])
    .filter((record) => record.name.startsWith("*"))
    .map((record) => `${record.type} ${record.name}`);

  const known = new Set<string>([...servedNames, ...explicitRecords, zone.name]);
  const wildcardOnlyHosts = (await observedHosts(zone.name, token, accountId, sinceIso)).filter(
    (host) => !known.has(host.hostname),
  );

  return {
    zone: zone.name,
    wildcardRecords,
    workerHosts: workerHosts.filter((host) => host.hostname.endsWith(zone.name)),
    explicitRecords,
    wildcardOnlyHosts,
    dnsReadable: records !== null,
  };
};

const renderMarkdown = (reports: ReadonlyArray<ZoneReport>, window: string): string => {
  const lines = [`# Hostname audit — traffic over the last ${window}`, ""];

  for (const report of reports) {
    lines.push(`## ${report.zone}`, "");
    if (!report.dnsReadable) {
      lines.push(
        "DNS records are not readable with this token (needs `DNS: Read`), so wildcard records and explicit names are unknown. Worker custom domains and observed hostnames below are still accurate.",
        "",
      );
    } else {
      lines.push(
        `Wildcard records: ${report.wildcardRecords.length === 0 ? "**none**" : report.wildcardRecords.map((record) => `\`${record}\``).join(", ")}`,
        "",
        `Explicit records: ${report.explicitRecords.length}`,
        "",
      );
    }

    lines.push(`### Answering only because of a wildcard (${report.wildcardOnlyHosts.length})`, "");
    if (report.wildcardOnlyHosts.length === 0) {
      lines.push(
        report.dnsReadable
          ? "None — every hostname that received traffic has an explicit record or a Worker custom domain."
          : "Unknown until DNS records are readable.",
        "",
      );
    } else {
      lines.push(
        "These hostnames received traffic with nothing explicit behind them. Narrowing the wildcard stops the zone answering for them.",
        "",
      );
      if (!report.dnsReadable) {
        lines.push(
          "Caveat: without `DNS: Read` the explicit records are unknown, so some of these may be served by a DNS-only record rather than the wildcard. Re-run with a DNS-capable token before deleting anything.",
          "",
        );
      }
      lines.push("| Requests | Hostname |", "| ---: | --- |");
      for (const host of report.wildcardOnlyHosts.slice(0, 40)) {
        lines.push(`| ${host.requests.toLocaleString("en-US")} | \`${host.hostname}\` |`);
      }
      lines.push("");
    }

    lines.push(`### Worker custom domains (${report.workerHosts.length})`, "");
    lines.push("These must keep answering; each is served by a named Worker.", "");
    lines.push("| Hostname | Worker |", "| --- | --- |");
    for (const host of report.workerHosts) {
      lines.push(`| \`${host.hostname}\` | \`${host.service}\` |`);
    }
    lines.push("");
  }

  return lines.join("\n");
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  if (args === null) return;

  const sinceIso = new Date(Date.now() - args.sinceMs).toISOString();
  const token = await resolveToken();
  const accountId = await resolveAccountId(token);

  const raw = await api<ReadonlyArray<{ hostname: string; service: string; zone_name: string }>>(
    `${API}/accounts/${accountId}/workers/domains`,
    token,
  );
  const workerHosts = (raw ?? []).map((domain) => ({
    hostname: domain.hostname,
    service: domain.service,
  }));

  const reports = await Promise.all(
    ZONES.map((zone) => auditZone(zone, token, accountId, sinceIso, workerHosts)),
  );

  const window =
    args.sinceMs < 3_600_000
      ? `${args.sinceMs / 60_000}m`
      : args.sinceMs < 86_400_000
        ? `${args.sinceMs / 3_600_000}h`
        : `${args.sinceMs / 86_400_000}d`;

  console.log(
    args.json ? JSON.stringify({ window, reports }, null, 2) : renderMarkdown(reports, window),
  );
};

main().then(
  () => undefined,
  (cause) => {
    console.error(
      `hostname-audit failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    process.exit(1);
  },
);
