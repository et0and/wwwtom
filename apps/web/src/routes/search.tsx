import { PageLayout } from "@tom/ui/PageLayout";
import { AddressSearch } from "~/components/AddressSearch";
import { BlurInText } from "~/components/BlurInText";
import { BlurInSection } from "~/components/BlurInSection";

export default function Search() {
  return (
    <PageLayout title="Address Search" description="Search NZ addresses via tsvector">
      <BlurInText text="Address Search" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.3}>
        <p class="mb-6 text-muted">
          Powered by Neon Postgres <code>tsvector</code> + <code>tsquery</code> with GIN, alias
          expansion, and typo correction. Reads hit the Neon read replica. Client debounces at 250ms
          and requires 3 characters.
        </p>
        <AddressSearch />
      </BlurInSection>
    </PageLayout>
  );
}
