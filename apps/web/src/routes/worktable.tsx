import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import { ArenaCarousel } from "~/content/Arena";

export default function Worktable() {
  return (
    <>
      <PageLayout title="Worktable" description="What I am currently working on or interested in">
        <Text variant="heading" size="lg" as="h1" blurIn>
          Worktable
        </Text>
        <div>
          <Text variant="heading" as="h2" blurIn>
            What I am currently working on or interested in
          </Text>
        </div>
        <div>
          <ArenaCarousel slug="tom-s-worktable" title="Tom's worktable" />
        </div>
        <div>
          <Text>
            At the moment I am focusing a lot on learning about data driven applications, as well as
            learning more about functional programming paradigms through libraries such as{" "}
            <a href="https://effect.website/">Effect</a>.
          </Text>
        </div>
      </PageLayout>
    </>
  );
}
