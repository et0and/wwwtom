import { PageLayout } from "~/layouts";
import { logger } from "@tom/utils";
import { HttpStatus } from "@tom/constants";

logger.info("Page not found", HttpStatus.NotFound);

export default function NotFound() {
  return (
    <PageLayout title="404" description="The page you are looking for does not exist.">
      {" "}
      <h1 class="text-center mx-auto p-4">Not found</h1>
    </PageLayout>
  );
}
