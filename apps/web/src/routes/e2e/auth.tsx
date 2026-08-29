import { PageLayout } from "@tom/ui/PageLayout";
import { BlurInText } from "~/components/BlurInText";
import { BlurInSection } from "~/components/BlurInSection";

export default function E2EAuthDemo() {
  return (
    <PageLayout
      title="Auth E2E Demo — Dev Only"
      description="Better Auth with D1 for dev e2e. SAML SSO and OAuth2 stub."
    >
      <BlurInText text="Auth E2E Demo" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.2}>
        <div class="banner" role="status">
          <p class="banner-title">Dev only</p>
          <p>
            Not linked from nav. Tests Better Auth with D1 via adapter. SAML stub ready for IdP
            config per organization.
          </p>
        </div>
        <p class="mb-4 text-muted">
          This route will host Better Auth flows: email + password, OAuth2 providers, SAML SSO per
          organization, and API key generation. Auth DB is D1 via Alchemy, separate from Neon
          address DB. See <code>docs/auth-commercialisation-plan.md</code>.
        </p>
        <ul class="list-disc pl-6 text-sm text-muted mb-4">
          <li>
            <code>POST /api/auth/sign-in/email</code> - email/password (dev)
          </li>
          <li>
            <code>POST /api/auth/sign-in/sso</code> - SAML SSO per org (stub)
          </li>
          <li>
            <code>POST /api/auth/sign-in/oauth2</code> - OAuth2 providers (stub)
          </li>
          <li>
            <code>POST /api/auth/api-key</code> - create service key after login
          </li>
        </ul>
        <p class="text-sm text-muted">
          Current status: stub. D1 binding and Better Auth wiring pending in <code>apps/api</code>.
          This page is the e2e target for dev. When wired, it will show login form and key manager.
        </p>
      </BlurInSection>
    </PageLayout>
  );
}
