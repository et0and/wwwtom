import { Title, Meta } from "@solidjs/meta";

export interface OgBrand {
  readonly suffix: string;
  readonly ogBase: string;
  readonly template?: string;
  readonly siteVerification?: string;
}

const TOM_BRAND: OgBrand = {
  suffix: "Tom Hackshaw",
  ogBase: "https://adapter.tom.so",
  siteVerification: "6F8B9658A3BC5775E2F116162AF518EE",
};

interface MetaProps {
  title: string | number;
  metaType: string;
  metaContent: string;
  canonical?: string;
  brand?: OgBrand;
  date?: string;
}

export function Metadata(props: MetaProps) {
  const description =
    props.metaContent || "Tom Hackshaw is a design engineer from Aotearoa New Zealand.";
  const brand = props.brand ?? TOM_BRAND;

  // Absolute URL: crawlers resolve og:image against the page, and the web
  // apps don't serve /api/og — go through the public adapter proxy, like all
  // other web → backend calls.
  const template = brand.template === undefined ? "" : `&template=${brand.template}`;
  const date = props.date ? `&date=${encodeURIComponent(props.date)}` : "";
  const ogImageUrl = `${brand.ogBase}/og?title=${encodeURIComponent(
    props.title.toString(),
  )}&summary=${encodeURIComponent(description)}${template}${date}`;

  return (
    <>
      <Title>
        {props.title} | {brand.suffix}
      </Title>
      <Meta name={props.metaType || "description"} content={description} />
      <Meta property="og:title" content={`${props.title} | ${brand.suffix}`} />
      <Meta property="og:description" content={description} />
      <Meta property="og:image" content={ogImageUrl} />
      <Meta name="twitter:title" content={`${props.title} | ${brand.suffix}`} />
      <Meta name="twitter:description" content={description} />
      <Meta name="twitter:image" content={ogImageUrl} />
      <Meta name="twitter:card" content="summary_large_image" />
      {props.canonical && <link rel="canonical" href={props.canonical} />}
      {brand.siteVerification && <Meta name="msvalidate.01" content={brand.siteVerification} />}
    </>
  );
}
