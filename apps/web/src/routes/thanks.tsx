import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";

export default function Thanks() {
  return (
    <PageLayout title="Thank you" description="Purchase completed successfully">
      <div class="max-w-md mx-auto space-y-6 text-center">
        <BlurInText text="Thank you!" tag="h1" baseDelay={0.1} step={0.025} />
        <BlurInSection delay={0.4}>
          <div class="space-y-4">
            <Text>
              Your purchase has been completed successfully. You should receive a confirmation email
              shortly.
            </Text>
          </div>
        </BlurInSection>
      </div>
    </PageLayout>
  );
}
