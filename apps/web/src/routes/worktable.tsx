import { ArenaCarousel, BlurInSection, BlurInText } from "~/components";
import { PageLayout } from "~/layouts";

export default function Worktable() {
  return (
    <>
      <PageLayout title="Worktable" description="What I am currently working on or interested in">
        <BlurInText text="Worktable" tag="h1" baseDelay={0.1} step={0.025} />
        <BlurInSection delay={0.3}>
          <h2>What I am currently working on or interested in</h2>
        </BlurInSection>
        <BlurInSection delay={0.5}>
          <ArenaCarousel slug="tom-s-worktable" title="Tom's worktable" />
        </BlurInSection>
        <BlurInSection delay={0.7}>
          <p>
            At the moment I am focusing a lot on learning about data driven applications, as well as
            learning more about functional programming paradigms through libraries such as{" "}
            <a href="https://effect.website/">Effect</a>.
          </p>
        </BlurInSection>
      </PageLayout>
    </>
  );
}
