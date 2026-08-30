import { httpStatus } from "@solidjs/web";
import { PageLayout } from "@tom/ui/PageLayout";
import { BlurInText } from "~/components/BlurInText";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants/http";

void Effect.runFork(Effect.logInfo("Page not found", HttpStatus.NotFound));

export default function NotFound() {
  httpStatus(HttpStatus.NotFound);
  return (
    <PageLayout title="404" description="The page you are looking for does not exist.">
      <BlurInText text="Not found" class="text-center mx-auto p-4" baseDelay={0.1} step={0.025} />
    </PageLayout>
  );
}
