import { PageLayout } from "~/layouts";
import { BlurInSection, BlurInText } from "~/components";

export default function Thanks() {
  return (
    <PageLayout title="Thank you" description="Purchase completed successfully">
      <div class="max-w-md mx-auto space-y-6 text-center">
        <BlurInText text="Thank you!" class="h1" baseDelay={0.1} step={0.025} />
        <BlurInSection delay={0.4}>
          <div class="space-y-4">
            <p>
              Your purchase has been completed successfully. You should receive a confirmation email
              shortly.
            </p>
          </div>
        </BlurInSection>
      </div>
    </PageLayout>
  );
}
