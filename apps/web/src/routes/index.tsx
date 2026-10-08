import * as stylex from "@stylexjs/stylex";
import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  signature: {
    height: "4rem",
    paddingBlockStart: "1rem",
    filter: { default: "none", [DARK]: "invert(1)" },
  },
});

export default function Home() {
  return (
    <>
      <PageLayout
        title="Home"
        description="Tom Hackshaw is a design engineer from Aotearoa, New Zealand"
      >
        <Text blurIn>Hi, I'm Tom,</Text>
        <div>
          <Text blurIn>
            I'm a software engineer with a background in the arts and education. Currently based in
            Pōneke, Te Whanganui-a-Tara.
          </Text>
        </div>
        <div>
          <Text blurIn>
            Building useful things for real people is the foundation of how I design and build
            systems.
          </Text>
        </div>
        <div>
          <Text blurIn>
            I would like to acknowledge Māori as tangata whenua and Te Tiriti o Waitangi partners in
            Aotearoa New Zealand. I pay my respects to the mana whenua who are the original and
            continued rightful stewards of the land.
          </Text>
        </div>
        <div>
          <Text blurIn lang="ja">
            こんにちは、トムです。
          </Text>
        </div>
        <div>
          <Text blurIn lang="ja">
            芸術と教育のバックグラウンドを持つ、ソフトウェアエンジニアです。現在はポーネケ（テ・ファンガヌイ＝ア＝タラ）を拠点に活動しています。
          </Text>
        </div>
        <div>
          <Text blurIn lang="ja">
            実際に人々の役に立つものを作ることを基本として、システムの設計と開発を行っています。
          </Text>
        </div>
        <div>
          <Text blurIn lang="ja">
            アオテアロア（ニュージーランド）の先住民族（タンガタ・フェヌア）であり、ワイタンギ条約のパートナーであるマオリの人々に敬意を表します。また、この土地の本来の、そして今も変わらぬ正当な守り手であるマナ・フェヌアに深く敬意を払います。
          </Text>
          <img src="/image.svg" alt="Tom Hackshaw signature" {...stylex.attrs(styles.signature)} />
        </div>
      </PageLayout>
    </>
  );
}
