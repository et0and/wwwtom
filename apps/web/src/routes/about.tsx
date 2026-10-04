import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";

export default function About() {
  return (
    <>
      <PageLayout title="About" description="About my background">
        <Text variant="heading" size="lg" as="h1">
          About
        </Text>
        <div>
          <Text>Hi, I'm Tom,</Text>
        </div>
        <div>
          <Text>
            I am a design engineer with a background in the arts and education. Presently I am
            working as a developer in Pōneke, Te Whanganui-a-Tara. Prior to this, I taught design,
            art and digital technology at{" "}
            <a href="https://takapuna.school.nz">Takapuna Grammar School</a>, where I also worked on
            the development of Te Wāhi Auaha (a school maker space and innovation space).
          </Text>
        </div>
        <div>
          <Text>
            My experience in making learning more accessible and equitable across a range of
            students from different backgrounds and abilities built the foundation of my
            human-centered design practice.
          </Text>
        </div>
        <div>
          <Text>
            Previously I studied at the{" "}
            <a href="https://en.wikipedia.org/wiki/Elam_School_of_Fine_Arts">
              Elam School of Fine Arts
            </a>{" "}
            where I also briefly taught the first and second year studio programme.
          </Text>
        </div>
        <div>
          <Text>
            Find me on <a href="https://are.na/tom">Are.na</a>,{" "}
            <a href="https://cv.tom.so/">Read.cv</a>, and{" "}
            <a href="https://merveilles.town/@tomupom">Merveilles</a>. Sometimes, I am on IRC as
            @tomupom on Libera Chat and Rizon networks. You can also find me on Urbit as
            ~worbur-dorneb.
          </Text>
        </div>
        <div>
          <Text>I have accounts on other popular social media sites, but rarely use them.</Text>
        </div>
        <div>
          <Text>
            See also: <a href="/worktable">what I am currently working on or interested in.</a>
          </Text>
        </div>
        <Text variant="heading" as="h2">
          Acknowledgements
        </Text>
        <div>
          <Text>
            I would like to acknowledge Māori as tangata whenua and Te Tiriti o Waitangi partners in
            Aotearoa New Zealand. I pay my respects to the mana whenua who are the original and
            continued rightful stewards of the land.
          </Text>
        </div>
        <div>
          <Text>
            I would also like to acknowledge the maintainers and contributors of the free and open
            source libraries that this website, along with many of my other projects, take advantage
            of. The full source code of this website can be found on my{" "}
            <a href="https://github.com/et0and/wwwtom">GitHub</a>.
          </Text>
        </div>
        <div>
          <Text>
            This website has gone through several iterations over the years. For more information
            about what is used and the history of this site,{" "}
            <a href="/posts/yet-another-rewrite">refer to this blog post</a>.
          </Text>
        </div>
        <div>
          <Text>Thank you for stopping by!</Text>
        </div>
      </PageLayout>
    </>
  );
}
