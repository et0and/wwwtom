import { run, workflow } from "../builders";
import { checkout, setupStep } from "../catalog/actions";
import { secret } from "../catalog/secrets";

/**
 * Temporarily block the loudest scanner IPs with zone IP Access Rules.
 *
 * Cloudflare access rules have no TTL, so the script writes the expiry into
 * the rule note and removes expired rules on the next hourly run. The token
 * needs Account: Read, Account Analytics: Read, Zone: Read and Zone Firewall
 * Access Rules: Edit; the existing CLOUDFLARE_API_TOKEN must be granted the
 * last one.
 */
export const infraBan = workflow("infra-ban", {
  name: "Temporary scanner IP bans",
  on: {
    schedule: [{ cron: "23 * * * *" }],
    workflow_dispatch: null,
  },
  permissions: { contents: "read" },
  concurrency: { group: "infra-ban", "cancel-in-progress": false },
  jobs: {
    ban: {
      name: "Ban loud scanner IPs",
      "runs-on": "namespace-profile-yufugumi",
      env: {
        CLOUDFLARE_ACCOUNT_ID: secret("CLOUDFLARE_DEFAULT_ACCOUNT_ID"),
        CLOUDFLARE_API_TOKEN: secret("CLOUDFLARE_API_TOKEN"),
      },
      steps: [
        checkout(),
        setupStep({ install: "false" }),
        run("Ban loud scanner IPs for six hours", [
          "node scripts/infra-ban.mts --apply --since=1h --ttl=6h",
        ]),
      ],
    },
  },
});
