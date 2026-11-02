import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import { FrameControl } from "~/frame/FrameControl";

export default function FramePage() {
  return (
    <PageLayout title="Frame" description="Control the desk frame">
      <Text variant="heading" size="lg" as="h1">
        Frame
      </Text>
      <FrameControl />
    </PageLayout>
  );
}
