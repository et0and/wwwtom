import { A } from "@solidjs/router";
import { PageLayout } from "~/layouts";

export default function About() {
  return (
    <>
      <PageLayout title="About" description="About my background">
        <h1>About</h1>
        <p>Hi, I'm Tom,</p>

        <p>
          I am a design engineer with a background in the arts and education. Presently I am working
          as a developer in Pōneke, Te Whanganui-a-Tara. Prior to this, I taught design, art and
          digital technology at <a href="https://takapuna.school.nz">Takapuna Grammar School</a>,
          where I also worked on the development of Te Wāhi Auaha (a school maker space and
          innovation space).
        </p>

        <p>
          My experience in making learning more accessible and equitable across a range of students
          from different backgrounds and abilities built the foundation of my human-centered design
          practice.
        </p>

        <p>
          Previously I studied at the{" "}
          <a href="https://en.wikipedia.org/wiki/Elam_School_of_Fine_Arts">
            Elam School of Fine Arts
          </a>{" "}
          where I also briefly taught the first and second year studio programme.
        </p>

        <p>
          Find me on <a href="https://are.na/tom">Are.na</a>,{" "}
          <a href="https://cv.tom.so/">Read.cv</a>, and{" "}
          <a href="https://merveilles.town/@tomupom">Merveilles</a>. Sometimes, I am on IRC as
          @tomupom on Libera Chat and Rizon networks. You can also find me on Urbit as
          ~worbur-dorneb.
        </p>

        <p>I have accounts on other popular social media sites, but rarely use them.</p>

        <p>
          See also: <A href="/worktable">what I am currently working on or interested in.</A>
        </p>

        <h2>Acknowledgements</h2>

        <p>
          I would like to acknowledge Māori as tangata whenua and Te Tiriti o Waitangi partners in
          Aotearoa New Zealand. I pay my respects to the mana whenua who are the original and
          continued rightful stewards of the land.
        </p>

        <p>
          I would also like to acknowledge the maintainers and contributors of the free and open
          source libraries that this website, along with many of my other projects, take advantage
          of. The full source code of this website can be found on my{" "}
          <a href="https://github.com/et0and/wwwtom">GitHub</a>.
        </p>

        <p>
          This website has gone through several iterations over the years. For more information
          about what is used and the history of this site,{" "}
          <a href="/posts/yet-another-rewrite">refer to this blog post</a>.
        </p>

        <p>Thank you for stopping by!</p>
      </PageLayout>
    </>
  );
}
