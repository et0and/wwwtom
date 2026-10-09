import { httpHeader } from "@solidjs/web";
import { PUBLIC_PAGE_CACHE_CONTROL, PUBLIC_PAGE_CDN_CACHE_CONTROL } from "@tom/constants/cache";
import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import { GardenPlayer } from "~/garden/GardenPlayer";

export default function Garden() {
  httpHeader("Cache-Control", PUBLIC_PAGE_CACHE_CONTROL);
  httpHeader("CDN-Cache-Control", PUBLIC_PAGE_CDN_CACHE_CONTROL);

  return (
    <PageLayout
      title="Garden"
      description="A small selection of ambient and piano music that plays forever, seeded by a word."
      canonical="https://tom.so/work/wwwork/garden"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: "Garden",
        description:
          "A small selection of ambient and piano music that plays forever, seeded by a word.",
        url: "https://tom.so/work/wwwork/garden",
        author: { "@type": "Person", name: "Tom Hackshaw" },
      }}
    >
      <Text variant="heading" size="lg" as="h1">
        Garden
      </Text>
      <div>
        <Text>
          A small selection of generative music. Each piece grows from a seed, so the same word
          always plays the same music. Press a tile to begin.
        </Text>
      </div>
      <GardenPlayer />
    </PageLayout>
  );
}
