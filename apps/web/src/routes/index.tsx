import { PageLayout } from "~/layouts";
import { BlurInSection, BlurInText } from "~/components";

export default function Home() {
  return (
    <>
      <PageLayout
        title="Home"
        description="Tom Hackshaw is a design engineer from Aotearoa, New Zealand"
      >
        <p>
          <BlurInText text="Hi, I'm Tom," baseDelay={0.1} step={0.025} />
        </p>
        <BlurInSection delay={0.4}>
          <p>
            I'm a software engineer with a background in the arts and education. Currently based in
            Pōneke, Te Whanganui-a-Tara.
          </p>
        </BlurInSection>
        <BlurInSection delay={0.6}>
          <p>
            Building useful things for real people is the foundation of how I design and build
            systems.
          </p>
        </BlurInSection>
        <BlurInSection delay={0.8}>
          <p>
            I would like to acknowledge Māori as tangata whenua and Te Tiriti o Waitangi partners in
            Aotearoa New Zealand. I pay my respects to the mana whenua who are the original and
            continued rightful stewards of the land.
          </p>
        </BlurInSection>
        <BlurInSection delay={1.0}>
          <p lang="ja">こんにちは、トムです。</p>
        </BlurInSection>
        <BlurInSection delay={1.2}>
          <p lang="ja">
            芸術と教育のバックグラウンドを持つ、ソフトウェアエンジニアです。現在はポーネケ（テ・ファンガヌイ＝ア＝タラ）を拠点に活動しています。
          </p>
        </BlurInSection>
        <BlurInSection delay={1.4}>
          <p lang="ja">
            実際に人々の役に立つものを作ることを基本として、システムの設計と開発を行っています。
          </p>
        </BlurInSection>
        <BlurInSection delay={1.6}>
          <p lang="ja">
            アオテアロア（ニュージーランド）の先住民族（タンガタ・フェヌア）であり、ワイタンギ条約のパートナーであるマオリの人々に敬意を表します。また、この土地の本来の、そして今も変わらぬ正当な守り手であるマナ・フェヌアに深く敬意を払います。
          </p>
          <img src="/image.svg" alt="Tom Hackshaw signature" class="h-16 pt-4 dark:invert" />
        </BlurInSection>
      </PageLayout>
    </>
  );
}
