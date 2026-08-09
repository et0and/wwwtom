import { A } from "@solidjs/router";
import { PageLayout } from "@tom/ui/PageLayout";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";

export default function About() {
  return (
    <>
      <PageLayout title="About" description="About my background">
        <BlurInText text="About" tag="h1" baseDelay={0.1} step={0.025} />
        <BlurInSection delay={0.3}>
          <p>Hi, I'm Tom,</p>
        </BlurInSection>
        <BlurInSection delay={0.5}>
          <p>
            I am a design engineer with a background in the arts and education. Presently I am
            working as a developer in Pōneke, Te Whanganui-a-Tara. Prior to this, I taught design,
            art and digital technology at{" "}
            <a href="https://takapuna.school.nz">Takapuna Grammar School</a>, where I also worked on
            the development of Te Wāhi Auaha (a school maker space and innovation space).
          </p>
        </BlurInSection>
        <BlurInSection delay={0.7}>
          <p>
            My experience in making learning more accessible and equitable across a range of
            students from different backgrounds and abilities built the foundation of my
            human-centered design practice.
          </p>
        </BlurInSection>
        <BlurInSection delay={0.9}>
          <p>
            Previously I studied at the{" "}
            <a href="https://en.wikipedia.org/wiki/Elam_School_of_Fine_Arts">
              Elam School of Fine Arts
            </a>{" "}
            where I also briefly taught the first and second year studio programme.
          </p>
        </BlurInSection>
        <BlurInSection delay={1.1}>
          <p>
            Find me on <a href="https://are.na/tom">Are.na</a>,{" "}
            <a href="https://cv.tom.so/">Read.cv</a>, and{" "}
            <a href="https://merveilles.town/@tomupom">Merveilles</a>. Sometimes, I am on IRC as
            @tomupom on Libera Chat and Rizon networks. You can also find me on Urbit as
            ~worbur-dorneb.
          </p>
        </BlurInSection>
        <BlurInSection delay={1.3}>
          <p>I have accounts on other popular social media sites, but rarely use them.</p>
        </BlurInSection>
        <BlurInSection delay={1.5}>
          <p>
            See also: <A href="/worktable">what I am currently working on or interested in.</A>
          </p>
        </BlurInSection>
        <BlurInText text="Acknowledgements" tag="h2" baseDelay={1.7} step={0.025} />
        <BlurInSection delay={1.9}>
          <p>
            I would like to acknowledge Māori as tangata whenua and Te Tiriti o Waitangi partners in
            Aotearoa New Zealand. I pay my respects to the mana whenua who are the original and
            continued rightful stewards of the land.
          </p>
        </BlurInSection>
        <BlurInSection delay={2.1}>
          <p>
            I would also like to acknowledge the maintainers and contributors of the free and open
            source libraries that this website, along with many of my other projects, take advantage
            of. The full source code of this website can be found on my{" "}
            <a href="https://github.com/et0and/wwwtom">GitHub</a>.
          </p>
        </BlurInSection>
        <BlurInSection delay={2.3}>
          <p>
            This website has gone through several iterations over the years. For more information
            about what is used and the history of this site,{" "}
            <a href="/posts/yet-another-rewrite">refer to this blog post</a>.
          </p>
        </BlurInSection>
        <BlurInSection delay={2.5}>
          <p>Thank you for stopping by!</p>
        </BlurInSection>
      </PageLayout>
    </>
  );
}
