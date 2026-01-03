import { Title, Meta } from "@solidjs/meta";

interface MetaProps {
  title: string | number;
  metaType: string;
  metaContent: string;
}

export function Metadata(props: MetaProps) {
  const description =
    props.metaContent || "Tom Hackshaw is a design engineer from Aotearoa New Zealand.";

  const ogImageUrl = `/api/og?title=${encodeURIComponent(props.title.toString())}&summary=${encodeURIComponent(description)}`;

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
    </>
  );
}
