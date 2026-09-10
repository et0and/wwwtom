import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import { ArenaCarousel } from "~/components/Arena";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";

export default function Worktable() {
  return (
    <>
      <PageLayout title="Worktable" description="What I am currently working on or interested in">
        <BlurInText text="Worktable" tag="h1" baseDelay={0.1} step={0.025} />
        <BlurInSection delay={0.3}>
          <Text variant="heading" as="h2">
            What I am currently working on or interested in
          </Text>
        </BlurInSection>
        <BlurInSection delay={0.5}>
          <ArenaCarousel slug="tom-s-worktable" title="Tom's worktable" />
        </BlurInSection>
        <BlurInSection delay={0.7}>
          <Text>
            At the moment I am focusing a lot on learning about data driven applications, as well as
            learning more about functional programming paradigms through libraries such as{" "}
            <a href="https://effect.website/">Effect</a>.
          </Text>
        </BlurInSection>
      </PageLayout>
    </>
  );
}
