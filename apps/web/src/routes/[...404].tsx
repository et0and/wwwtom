import { httpStatus, isServer } from "@solidjs/web";
import { PageLayout } from "@tom/ui/PageLayout";
import { BlurInText } from "~/components/BlurInText";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { bannerTitleStyles } from "../components/layout.stylex";

export default function NotFound() {
  if (isServer) void Effect.runFork(Effect.logInfo("Page not found", HttpStatus.NotFound));
  httpStatus(HttpStatus.NotFound);
  return (
    <PageLayout title="404" description="The page you are looking for does not exist.">
      <BlurInText
        text="Not found"
        style={bannerTitleStyles.notFound}
        baseDelay={0.1}
        step={0.025}
      />
    </PageLayout>
  );
}
