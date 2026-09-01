import { Title, Meta } from "@solidjs/meta";

interface MetaProps {
  title: string | number;
  metaType: string;
  metaContent: string;
  canonical?: string;
}

export function Metadata(props: MetaProps) {
  const description =
    props.metaContent || "Tom Hackshaw is a design engineer from Aotearoa New Zealand.";

  // Absolute URL: crawlers resolve og:image against the page, and tom.so
  // doesn't serve /api/og — go through the public adapter proxy, like all
  // other web → backend calls.
  const ogImageUrl = `https://adapter.tom.so/og?title=${encodeURIComponent(
    props.title.toString(),
  )}&summary=${encodeURIComponent(description)}`;

  return (
    <>
      <Title>{props.title} | Tom Hackshaw</Title>
      <Meta name={props.metaType || "description"} content={description} />
      <Meta property="og:title" content={`${props.title} | Tom Hackshaw`} />
      <Meta property="og:description" content={description} />
      <Meta property="og:image" content={ogImageUrl} />
      <Meta name="twitter:title" content={`${props.title} | Tom Hackshaw`} />
      <Meta name="twitter:description" content={description} />
      <Meta name="twitter:image" content={ogImageUrl} />
      <Meta name="twitter:card" content="summary_large_image" />
      {props.canonical && <link rel="canonical" href={props.canonical} />}
      <Meta name="msvalidate.01" content="6F8B9658A3BC5775E2F116162AF518EE" />
    </>
  );
}
