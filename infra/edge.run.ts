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
 * blending into the 404s.
 */
const CREDENTIAL_PATHS = ["/.env", "/.git", "/.svn", "/.ssh", "/.aws"] as const;

/**
 * Everything else no visitor or crawler requests. Matched case-insensitively
 * because scanners vary casing to dodge naive rules. This account serves no
 * WordPress, no PHP and no admin panel, so any hit is a probe.
 */
const PROBE_PATHS = [
  "/.ds_store",
  "/wp-",
  "/xmlrpc.php",
  "/phpmyadmin",
  "/adminer",
  "/phpinfo",
  ".sql",
  ".bak",
  ".old",
  "/tfstate",
  "docker-compose",
  "backup",
] as const;

const pathContains = (paths: ReadonlyArray<string>): string =>
  paths.map((path) => `lower(http.request.uri.path) contains "${path}"`).join(" or ");

/**
 * Static assets are excluded from the rate limit: one page view pulls many,
 * and they are served from cache anyway. Everything else — pages, the
 * adapter proxy, the API — counts toward the per-IP budget.
 */
const ASSET_PATH = String.raw`\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|map)$`;

const probeRuleset = (zone: Cloudflare.Zone.Zone, zoneId: string) =>
  Cloudflare.Ruleset.Ruleset(`EdgeProbeRules-${zoneId}`, {
    zone,
    phase: "http_request_firewall_custom",
    description:
      "Answer reconnaissance probes at the edge: credential files, VCS metadata, WordPress paths, admin panels, backups.",
    rules: [
      {
        description: "Block credential and key material paths",
        expression: pathContains(CREDENTIAL_PATHS),
        action: "block",
      },
      {
        description: "404 the remaining probe surface",
        expression: pathContains(PROBE_PATHS),
        action: "block",
        actionParameters: {
          response: {
            statusCode: 404,
            content: "Not found",
            contentType: "text/plain",
          },
        },
      },
    ],
  });

/**
 * One rate limiting rule per zone on purpose: the Free plan allows a single
 * rate limiting rule, so adding a second would fail to deploy. The window is
 * generous enough that a person reading the site never sees it — a scanner
 * sweeping thousands of paths hits it immediately.
 */
const rateLimitRuleset = (zone: Cloudflare.Zone.Zone, zoneId: string) =>
  Cloudflare.Ruleset.Ruleset(`EdgeRateLimit-${zoneId}`, {
    zone,
    phase: "http_ratelimit",
    description: "Blunt sustained per-IP scanning and credential brute force.",
    rules: [
      {
        description: "Rate limit non-asset requests per IP",
        expression: `not (http.request.uri.path matches "${ASSET_PATH}")`,
        action: "block",
        actionParameters: {
          response: {
            statusCode: 429,
            content: "Too many requests",
            contentType: "text/plain",
          },
        },
        ratelimit: {
          characteristics: ["ip.src"],
          period: 60,
          requestsPerPeriod: 120,
          mitigationTimeout: 60,
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
