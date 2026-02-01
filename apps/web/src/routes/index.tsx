import { ArenaCarousel } from "~/components";
import { PageLayout } from "~/layouts";

export default function Home() {
  return (
    <>
      <PageLayout
        title="Home"
        description="Tom Hackshaw is a design engineer from Aotearoa, New Zealand"
      >
        <ArenaCarousel slug="imaginary-museum" title="Imaginary museum" />
      </PageLayout>
    </>
  );
}
