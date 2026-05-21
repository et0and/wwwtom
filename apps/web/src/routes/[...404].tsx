import { PageLayout } from "~/layouts";
import { BlurInText } from "~/components";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants";

void Effect.runFork(Effect.logInfo("Page not found", HttpStatus.NotFound));

export default function NotFound() {
  return (
    <PageLayout title="404" description="The page you are looking for does not exist.">
      <BlurInText text="Not found" class="text-center mx-auto p-4" baseDelay={0.1} step={0.025} />
    </PageLayout>
  );
}
