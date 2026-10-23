import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stack } from "alchemy/Stack";
import { adopt } from "alchemy/AdoptPolicy";

/**
 * Edge protection for the public zones: answer reconnaissance probes at the
 * edge instead of letting them reach an origin.
 *
 * A scanner's `.env`/`.git`/`.svn`/WordPress sweep is roughly a third of all
 * requests to this account, and none of it should ever reach a Worker. These
 * rules turn that traffic into a cheap 403/404 before routing, which cuts
 * origin invocations, stops the app's soft-404 behaviour from telling a
 * scanner it found something, and keeps the noise out of request analytics.
 *
 * The zones are adopted, not created. `Zone` defaults to retain on removal,
 * so destroying this stack leaves the zones alone; `adopt(true)` is what
 * lets the engine target the zones that already exist. This stack does own
 * both phase entrypoints, so rules added to those phases in the dashboard are
 * overwritten on the next deploy.
 *
 * Requires a token with `Zone WAF: Edit` plus `Zone: Read` and
 * `Account: Read` (see README).
 */

/** Zone ids, stable for the life of each zone. */
const ZONES = [
  { name: "tom.so", zoneId: "d431d14124866e4d3fff6cdd5b727926" },
  { name: "sophie.st", zoneId: "f9fdf74d0ac40a9cc01dc4c8cfa5af6a" },
] as const;

type ZoneRef = (typeof ZONES)[number];

/** Adopt the pre-existing zone so it can be targeted without owning it. */
const adoptZone = (zone: ZoneRef) =>
  Cloudflare.Zone.Zone(`Zone-${zone.zoneId}`, { name: zone.name }).pipe(adopt(true));

/**
 * Credential and key material: paths whose only purpose is to be stolen.
 * Blocked with a 403 so they stand out in firewall analytics instead of
 * blending into the 404s. `.env` matches anywhere in the path, so suffix
 * variants such as `/application/.local.env` are covered too, not only a
 * leading `/.env`. Covers the credential files scanners ask for by name —
 * `.dev.vars`, shell and package config, key material, cloud credentials,
 * Terraform variable values, package registry tokens, database and cluster
 * credentials, framework settings, secret files and the container token path.
 */
const CREDENTIAL_PATHS = [
  ".env",
  "/.git",
  "/.svn",
  "/.ssh",
  "/.aws",
  "/.dev.vars",
  "/.htpasswd",
  "/.npmrc",
  "/.s3cfg",
  "/.zshrc",
  "/.bashrc",
  "/.netrc",
  "/_netrc",
  "/.pgpass",
  ".pem",
  ".key",
  "id_rsa",
  "id_ed25519",
  ".p12",
  ".pfx",
  "private-key",
  "private_key",
  "id_dsa",
  "id_ecdsa",
  "credentials.json",
  "docker/config.json",
  "proc/self/environ",
  "service-account",
  "serviceaccount",
  "cargo/credentials",
  "sa.json",
  "secrets.",
  "auth.json",
  ".my.cnf",
  "settings.py",
  "database.yml",
  ".pypirc",
  "gem/credentials",
  "kube/config",
  "kubeconfig",
  "sftp-config",
  "vscode/sftp.json",
  "aws/credentials",
  "gcp-key.json",
  "firebase-adminsdk",
  "terraform.tfvars",
] as const;

/**
 * Everything else no visitor or crawler requests. Matched case-insensitively
 * because scanners vary casing to dodge naive rules. This account serves no
 * WordPress, no PHP, no admin panel and no repository or agent-tooling files,
 * so any hit is a probe.
 */
const PROBE_PATHS = [
  "/.ds_store",
  "/.dockerenv",
  "/wp-",
  ".php",
  "/administrator",
  "/phpmyadmin",
  "/adminer",
  "/admin",
  "/phpinfo",
  "/server-status",
  "/actuator",
  "/config.json",
  ".sql",
  ".bak",
  ".old",
  "tfstate",
  "docker-compose",
  "backup",
  "/claude.md",
  "/agents.md",
  "/readme.md",
  "/jenkinsfile",
  "mcp.json",
  "/.claude",
  "claude.json",
] as const;

const pathContains = (paths: ReadonlyArray<string>): string =>
  paths.map((path) => `lower(http.request.uri.path) contains "${path}"`).join(" or ");

/**
 * Static assets are excluded from the rate limit: one page view pulls many,
 * and they are served from cache anyway. Everything else — pages, the
 * adapter proxy, the API — counts toward the per-IP budget.
 *
 * The `matches` operator needs a Business/Enterprise plan (or WAF Advanced),
 * and both zones are on Free, so the exclusion uses the lowercased path
 * extension instead of a regex. Workers Paid is account-level and does not
 * change this zone entitlement.
 */
const ASSET_EXTENSIONS = [
  "js",
  "mjs",
  "css",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "avif",
  "ico",
  "woff",
  "woff2",
  "ttf",
  "map",
] as const;

const IS_ASSET_PATH = `http.request.uri.path.extension in {${ASSET_EXTENSIONS.map(
  (extension) => `"${extension}"`,
).join(" ")}}`;

/**
 * Both zones are on the Free plan, and its custom-rule response is the
 * default 403 block page: custom response codes and bodies need Pro. The
 * two rules stay separate anyway so credential probes still stand out by
 * rule name in firewall analytics.
 */
const probeRuleset = (zone: Cloudflare.Zone.Zone, zoneId: string) =>
  Cloudflare.Ruleset.Ruleset(`EdgeProbeRules-${zoneId}`, {
    zone,
    phase: "http_request_firewall_custom",
    description:
      "Answer reconnaissance probes at the edge: credential files, VCS metadata, WordPress paths, admin panels, backups.",
    rules: [
      {
        // The Worker and custom domain were never removed (see README,
        // "Retired hosts"), so the stale origin still answers 200 for every
        // path. Block the host at the edge until the Worker is deleted.
        // Hostnames are case-insensitive, but `http.host` keeps the client's
        // casing, so compare the lowercased value like the path rules do.
        description: "Retire preview.tom.so: the orphaned Worker answers 200 for every path",
        expression: 'lower(http.host) eq "preview.tom.so"',
        action: "block",
      },
      {
        description: "Block credential and key material paths",
        expression: pathContains(CREDENTIAL_PATHS),
        action: "block",
      },
      {
        description: "Block the remaining probe surface",
        expression: pathContains(PROBE_PATHS),
        action: "block",
      },
      {
        // A retired app on a stale origin still answers, and its admin login
        // reads as a find. Block the whole host until the hosting project and
        // DNS record are removed (see README, "Retired hosts"). `http.host`
        // keeps the client's casing, so compare the lowercased value.
        description: "Retire payload.tom.so: the retired Payload CMS still answers /admin",
        expression: 'lower(http.host) eq "payload.tom.so"',
        action: "block",
      },
      {
        // Cloudflare normalizes `http.request.uri.path` before custom rules
        // and always merges adjacent slashes, so only the raw path still sees
        // the malformed sequence. The app's router soft-200s when `//` or two
        // slash-like characters appear anywhere in the path:
        // `/x//config.json`, `/x/\config.json`, `/x\/config.json` and
        // `/x\\config.json` all return its 200 shell while `/x/config.json`
        // 404s. Block `//` anywhere and any raw backslash, which covers the
        // remaining combinations.
        description: "Block malformed slash and backslash paths",
        expression: String.raw`raw.http.request.uri.path contains "//" or raw.http.request.uri.path contains "\\"`,
        action: "block",
      },
    ],
  });

/**
 * One rate limiting rule per zone on purpose: the Free plan allows a single
 * rate limiting rule, so adding a second would fail to deploy. The same plan
 * caps the counting period and mitigation timeout at 10s and rejects the
 * `matches` operator; Workers Paid is account-level and does not change these
 * zone entitlements. 20 requests per 10s preserves the original 120-per-minute
 * budget. That is generous enough that a person reading the site never sees
 * it — a scanner sweeping thousands of paths hits it immediately.
 */
const rateLimitRuleset = (zone: Cloudflare.Zone.Zone, zoneId: string) =>
  Cloudflare.Ruleset.Ruleset(`EdgeRateLimit-${zoneId}`, {
    zone,
    phase: "http_ratelimit",
    description: "Blunt sustained per-IP scanning and credential brute force.",
    rules: [
      {
        description: "Rate limit non-asset requests per IP",
        expression: `not (${IS_ASSET_PATH})`,
        action: "block",
        ratelimit: {
          // Cloudflare counts rate limits at the colocation, so cf.colo.id
          // is mandatory in characteristics even though the budget is per IP.
          characteristics: ["ip.src", "cf.colo.id"],
          period: 10,
          requestsPerPeriod: 20,
          mitigationTimeout: 10,
        },
      },
    ],
  });

export default Stack(
  "wwwtom-edge",
  {
    providers: Cloudflare.providers() as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const rulesets = yield* Effect.forEach(ZONES, (ref) =>
      Effect.gen(function* () {
        const zone = yield* adoptZone(ref);
        const probes = yield* probeRuleset(zone, ref.zoneId);
        const rateLimit = yield* rateLimitRuleset(zone, ref.zoneId);
        return {
          zone: ref.name,
          probeRulesetId: probes.rulesetId,
          rateLimitRulesetId: rateLimit.rulesetId,
        };
      }),
    );

    return { rulesets };
  }),
);
