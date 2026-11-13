/**
 * Infra ban: temporarily block the loudest scanner IPs with Cloudflare IP
 * Access Rules, and remove expired ones.
 *
 * Cloudflare access rules have no TTL, so each rule's note carries the expiry
 * (`infra-ban:<ISO timestamp> probes=<count>`). Every run removes expired
 * rules before adding new ones, which makes the ban temporary without a
 * separate cleanup job.
 *
 * The job reads the same probe families as `scripts/infra-scan.mts`, counts
 * them per client IP over the window, and only bans IPs above the threshold.
 * Cloudflare's egress ranges and private addresses are skipped: the account's
 * own Worker subrequests must never be banned.
 *
 * Run:
 *   node scripts/infra-ban.mts --dry-run
 *   node scripts/infra-ban.mts --apply --since=1h --ttl=6h
 *
 * Env:
 *   CLOUDFLARE_API_TOKEN   needs Account: Read, Account Analytics: Read,
 *                          Zone: Read and Zone Firewall Access Rules: Edit
 *   CLOUDFLARE_ACCOUNT_ID  else discovered from GET /accounts
 */

import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://api.cloudflare.com/client/v4";
const GRAPHQL_URL = `${API}/graphql`;
const USER_AGENT = "wwwtom-infra-ban/1.0 (+https://github.com/et0and/wwwtom)";

/** Zones this repo owns. Keep in sync with `infra/edge.run.ts`. */
const ZONES = [
  { name: "tom.so", zoneId: "d431d14124866e4d3fff6cdd5b727926" },
  { name: "sophie.st", zoneId: "f9fdf74d0ac40a9cc01dc4c8cfa5af6a" },
] as const;

type ZoneRef = (typeof ZONES)[number];

/**
 * Probe families the ban job counts. These mirror the high-signal patterns in
 * `scripts/infra-scan.mts`; the ban only needs enough signal to separate a
 * scanner from a crawler, so the full report list is not required.
 */
const PROBE_LIKES = [
  "%.env%",
  "%.git%",
  "%.svn%",
  "%wp-%",
  "%config%.php%",
  "%phpmyadmin%",
  "%adminer%",
  "%backup%",
  "%phpinfo%",
  "%id_rsa%",
  "%aws/credentials%",
  "%tfstate%",
  "%docker-compose%",
  "%.ds_store%",
  "%/admin%",
] as const;

const OWN_HOST_SUFFIXES = ["tom.so", "sophie.st"] as const;
const BAN_PREFIX = "infra-ban:";

type Args = {
  sinceMs: number;
  ttlMs: number;
  minProbes: number;
  maxNew: number;
  maxActive: number;
  apply: boolean;
};

type Candidate = { readonly ip: string; readonly count: number };

type AccessRule = {
  readonly id: string;
  readonly mode: string;
  readonly configuration: { readonly target: string; readonly value: string };
  readonly notes?: string;
};

type ApiBody<T> = {
  readonly result?: T;
  readonly result_info?: { readonly total_pages?: number };
  readonly success?: boolean;
  readonly errors?: ReadonlyArray<{ readonly code?: number; readonly message?: string }>;
};

type AnalyticsGroup = {
  readonly count: number;
  readonly dimensions: {
    readonly clientIP?: string;
  };
};

type AnalyticsBody = {
  readonly data?: {
    readonly viewer: {
      readonly accounts: ReadonlyArray<{ readonly groups: ReadonlyArray<AnalyticsGroup> }>;
    };
  };
  readonly errors?: ReadonlyArray<{ readonly message: string }> | null;
};

const HELP = `Usage: node scripts/infra-ban.mts [options]

  --apply              create and delete rules (default: dry run)
  --since=<window>     probe lookback: 15m/1h/6h/24h (default 1h)
  --ttl=<window>       ban duration: 15m/1h/6h/24h (default 6h)
  --min-probes=<n>     minimum probe requests per IP (default 200)
  --max-new=<n>        new rules per zone per run (default 5)
  --max-active=<n>     active infra rules per zone (default 10)
  --help               show this message
`;

const parseDuration = (raw: string): number | null => {
  const match = /^(\d+)([mhd])$/.exec(raw.trim());
  const value = match?.[1];
  const unit = match?.[2];
  if (value === undefined || unit === undefined) return null;
  const scale = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return Number(value) * scale;
};

const windowLabel = (ms: number): string =>
  ms < 3_600_000
    ? `${ms / 60_000}m`
    : ms < 86_400_000
      ? `${ms / 3_600_000}h`
      : `${ms / 86_400_000}d`;

const parseCount = (raw: string, flag: string): number => {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${flag} expects a non-negative integer, got "${raw}"`);
  }
  return value;
};

const parseArgs = (argv: ReadonlyArray<string>): Args | null => {
  const args: Args = {
    sinceMs: 3_600_000,
    ttlMs: 6 * 3_600_000,
    minProbes: 200,
    maxNew: 5,
    maxActive: 10,
    apply: false,
  };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(HELP);
      return null;
    }
    if (arg === "--apply") {
      args.apply = true;
      continue;
    }
    if (arg === "--dry-run") {
      args.apply = false;
      continue;
    }
    const since = /^--since=(.+)$/.exec(arg)?.[1];
    if (since !== undefined) {
      const ms = parseDuration(since);
      if (ms === null) throw new Error(`--since expects 15m/1h/6h/24h, got "${since}"`);
      args.sinceMs = ms;
      continue;
    }
    const ttl = /^--ttl=(.+)$/.exec(arg)?.[1];
    if (ttl !== undefined) {
      const ms = parseDuration(ttl);
      if (ms === null) throw new Error(`--ttl expects 15m/1h/6h/24h, got "${ttl}"`);
      args.ttlMs = ms;
      continue;
    }
    const minProbes = /^--min-probes=(.+)$/.exec(arg)?.[1];
    if (minProbes !== undefined) {
      args.minProbes = parseCount(minProbes, "--min-probes");
      if (args.minProbes < 1) throw new Error("--min-probes must be at least 1");
      continue;
    }
    const maxNew = /^--max-new=(.+)$/.exec(arg)?.[1];
    if (maxNew !== undefined) {
      args.maxNew = parseCount(maxNew, "--max-new");
      continue;
    }
    const maxActive = /^--max-active=(.+)$/.exec(arg)?.[1];
    if (maxActive !== undefined) {
      args.maxActive = parseCount(maxActive, "--max-active");
      continue;
    }
    throw new Error(`unknown argument "${arg}" (try --help)`);
  }
  return args;
};

/** The local wrangler OAuth token, for interactive runs. */
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

type RequestInit = { readonly method?: string; readonly body?: string };

async function requestJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "User-Agent": USER_AGENT,
  };
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers,
    ...(init?.body === undefined ? {} : { body: init.body }),
  });
  const text = await response.text();
  const body = (text === "" ? {} : JSON.parse(text)) as T;
  if (!response.ok) throw new Error(`${url} responded ${response.status}: ${text}`);
  return body;
}

function api<T>(path: string, token: string, init?: RequestInit): Promise<ApiBody<T>> {
  return requestJson<ApiBody<T>>(`${API}${path}`, token, init);
}

function graphql<T>(query: string, token: string): Promise<T> {
  return requestJson<T>(GRAPHQL_URL, token, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

const resolveAccountId = async (token: string): Promise<string> => {
  const fromEnv = process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID;
  if (fromEnv) return fromEnv;
  const body = await api<ReadonlyArray<{ readonly id: string }>>("/accounts", token);
  const account = body.result?.[0];
  if (!account) throw new Error("the token can read no accounts; set CLOUDFLARE_ACCOUNT_ID");
  return account.id;
};

const hostClauses = (hostname: string): ReadonlyArray<string> => [
  `{ clientRequestHTTPHost: "${hostname}" }`,
  `{ clientRequestHTTPHost_like: "${hostname}:%" }`,
  `{ clientRequestHTTPHost_like: "%.${hostname}" }`,
  `{ clientRequestHTTPHost_like: "%.${hostname}:%" }`,
];

const OWN_HOST_CLAUSES = OWN_HOST_SUFFIXES.flatMap(hostClauses);
const PROBE_CLAUSES = PROBE_LIKES.map((like) => `{ clientRequestPath_like: "${like}" }`);

const isPrivateV4 = (ip: string): boolean => {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
};

/** Cloudflare's published IPv4 ranges; the account's own egress must not be banned. */
const isCloudflareV4 = (ip: string): boolean => {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    (a === 103 && (b === 21 || b === 22 || b === 31)) ||
    (a === 104 && b >= 16 && b <= 31) ||
    (a === 108 && b === 162) ||
    (a === 131 && b === 0) ||
    (a === 141 && b === 101) ||
    (a === 162 && b === 158) ||
    (a === 172 && b >= 64 && b <= 71) ||
    (a === 173 && b === 245) ||
    (a === 188 && b === 114) ||
    (a === 190 && b === 93) ||
    (a === 197 && b === 234) ||
    (a === 198 && b === 41)
  );
};

/**
 * Cloudflare egress and private addresses must never be banned: the former is
 * the account's own Worker traffic, the latter cannot be a real client.
 */
const isSkippedIp = (ip: string): boolean => {
  if (ip.startsWith("2a06:98c0:") || ip.startsWith("2400:cb00:") || ip.startsWith("2606:4700:")) {
    return true;
  }
  const version = isIP(ip);
  if (version === 0) return true;
  if (version === 6) {
    return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80");
  }
  return isCloudflareV4(ip) || isPrivateV4(ip);
};

const topProbeIps = async (
  accountId: string,
  token: string,
  args: Args,
): Promise<ReadonlyArray<Candidate>> => {
  const sinceIso = new Date(Date.now() - args.sinceMs).toISOString();
  const query = `query {
    viewer {
      accounts(filter: { accountTag: "${accountId}" }) {
        groups: httpRequestsAdaptiveGroups(
          limit: 100,
          filter: {
            datetime_geq: "${sinceIso}",
            AND: [
              { OR: [${OWN_HOST_CLAUSES.join(", ")}] },
              { OR: [${PROBE_CLAUSES.join(", ")}] }
            ]
          },
          orderBy: [count_DESC]
        ) {
          count
          dimensions {
            clientIP
          }
        }
      }
    }
  }`;

  const body = await graphql<AnalyticsBody>(query, token);
  if (body.errors !== undefined && body.errors !== null && body.errors.length > 0) {
    throw new Error(
      `analytics query failed: ${body.errors.map((error) => error.message).join("; ")}`,
    );
  }

  const groups = body.data?.viewer.accounts[0]?.groups ?? [];
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const group of groups) {
    const ip = group.dimensions.clientIP;
    if (ip === undefined || seen.has(ip)) continue;
    if (group.count < args.minProbes || isSkippedIp(ip)) continue;
    seen.add(ip);
    candidates.push({ ip, count: group.count });
  }
  return candidates;
};

const listAccessRules = async (
  zoneId: string,
  token: string,
): Promise<ReadonlyArray<AccessRule>> => {
  const rules: AccessRule[] = [];
  // A zone should never have 1,000 access rules; cap pagination so a broken
  // result_info cannot make the job loop forever.
  for (const page of Array.from({ length: 10 }, (_, index) => index + 1)) {
    const body = await api<ReadonlyArray<AccessRule>>(
      `/zones/${zoneId}/firewall/access_rules/rules?per_page=100&page=${page}`,
      token,
    );
    rules.push(...(body.result ?? []));
    if (page >= (body.result_info?.total_pages ?? 1)) break;
  }
  return rules;
};

const createAccessRule = async (
  zone: ZoneRef,
  ip: string,
  notes: string,
  token: string,
): Promise<void> => {
  await api<AccessRule>(`/zones/${zone.zoneId}/firewall/access_rules/rules`, token, {
    method: "POST",
    body: JSON.stringify({
      mode: "block",
      configuration: { target: isIP(ip) === 6 ? "ip6" : "ip", value: ip },
      notes,
    }),
  });
};

const deleteAccessRule = async (zoneId: string, ruleId: string, token: string): Promise<void> => {
  await api<null>(`/zones/${zoneId}/firewall/access_rules/rules/${ruleId}`, token, {
    method: "DELETE",
  });
};

const isInfraBan = (rule: AccessRule): boolean => (rule.notes ?? "").startsWith(BAN_PREFIX);

const expiryOf = (rule: AccessRule): number | null => {
  const raw = (rule.notes ?? "").slice(BAN_PREFIX.length).split(" ")[0];
  if (raw === undefined || raw === "") return null;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : null;
};

const applyZone = async (
  zone: ZoneRef,
  candidates: ReadonlyArray<Candidate>,
  args: Args,
  token: string,
  now: number,
): Promise<void> => {
  const rules = await listAccessRules(zone.zoneId, token).catch((cause: unknown) => {
    if (args.apply) throw cause;
    const message = cause instanceof Error ? cause.message : String(cause);
    console.warn(`cannot read ${zone.name} access rules: ${message}`);
    console.warn(
      "dry run continues with candidates only; apply needs Zone Firewall Access Rules: Edit",
    );
    return [] as ReadonlyArray<AccessRule>;
  });

  const expired = rules.filter(
    (rule) => isInfraBan(rule) && (expiryOf(rule) ?? Number.POSITIVE_INFINITY) <= now,
  );
  const expiredIds = new Set(expired.map((rule) => rule.id));
  const remaining = rules.filter((rule) => !expiredIds.has(rule.id));

  for (const rule of expired) {
    if (args.apply) await deleteAccessRule(zone.zoneId, rule.id, token);
  }

  const active = remaining.filter(isInfraBan);
  const existing = new Set(remaining.map((rule) => rule.configuration.value));
  const capacity = Math.max(0, args.maxActive - active.length);
  const toBan = candidates
    .filter((candidate) => !existing.has(candidate.ip))
    .slice(0, Math.min(args.maxNew, capacity));

  for (const candidate of toBan) {
    if (!args.apply) continue;
    const expiresAt = new Date(now + args.ttlMs).toISOString();
    await createAccessRule(
      zone,
      candidate.ip,
      `${BAN_PREFIX}${expiresAt} probes=${candidate.count}`,
      token,
    );
  }

  console.log(
    `${zone.name}: ${expired.length} expired, ${toBan.length} ${args.apply ? "banned" : "would ban"}, ${active.length + toBan.length} ${args.apply ? "active" : "would be active"}`,
  );
  for (const candidate of toBan) {
    console.log(
      `  ${args.apply ? "banned" : "would ban"} ${candidate.ip} (${candidate.count} probes)`,
    );
  }
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  if (args === null) return;

  const token = await resolveToken();
  const accountId = await resolveAccountId(token);
  const candidates = await topProbeIps(accountId, token, args);

  console.log(
    `infra-ban — ${args.apply ? "apply" : "dry run"}; window ${windowLabel(args.sinceMs)}, ttl ${windowLabel(args.ttlMs)}, min ${args.minProbes} probes`,
  );
  console.log(`candidates: ${candidates.length}`);
  for (const candidate of candidates) console.log(`  ${candidate.ip} ${candidate.count}`);

  const now = Date.now();
  for (const zone of ZONES) await applyZone(zone, candidates, args, token, now);

  if (!args.apply) console.log("dry run: no rules changed.");
};

main().then(
  () => undefined,
  (cause) => {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(`infra-ban failed: ${message}`);
    if (/\b403\b|10000|Authentication/.test(message)) {
      console.error(
        "the token needs Account: Read, Account Analytics: Read, Zone: Read and Zone Firewall Access Rules: Edit",
      );
    }
    process.exit(1);
  },
);
