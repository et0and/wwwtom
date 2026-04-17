import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Media } from "@/payload-types";
import { siteNav } from "@/app/(frontend)/site-config";
import { SideBySide } from "@/components/SideBySide";
import { QuantityForm } from "@/components/QuantityForm";
import { formatNZD } from "@/lib/formatNZD";
import { getPublishedProductBySlug, getPublishedProductsPage } from "../product-data";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: ProductPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getPublishedProductBySlug(slug);

  if (product == null) {
    return {};
  }

  return {
    title: product.meta?.title ?? product.name,
    description: product.meta?.description ?? product.shortDescription ?? undefined,
  };
}

export async function generateStaticParams() {
  try {
    const result = await getPublishedProductsPage(1);
    return result.docs.map((product) => ({ slug: product.slug }));
  } catch {
    return [];
  }
}

export default async function ProductPage(props: ProductPageProps) {
  const { slug } = await props.params;
  const product = await getPublishedProductBySlug(slug);

  if (product == null) {
    notFound();
  }

  const isPurchasable =
    product._status === "published" &&
    product.isAvailable === true &&
    product.stripeSync?.stripeSyncStatus === "synced" &&
    Boolean(product.stripeSync?.stripePriceId);

  const featuredImage =
    product.featuredImage != null && typeof product.featuredImage !== "number"
      ? (product.featuredImage as Media)
      : null;

  return (
    <SideBySide nav={siteNav}>
      <div className="space-y-8 max-w-2xl">
        {featuredImage?.url != null && (
          <div className="relative w-full aspect-[4/3] overflow-hidden rounded">
            <Image
              src={featuredImage.url}
              alt={featuredImage.alt}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 672px"
            />
          </div>
        )}

        <div className="space-y-3">
          <h1 className="text-3xl font-medium">{product.name}</h1>
          <p className="text-lg font-medium">
            {formatNZD(product.unitAmountNZD)}{" "}
            <span className="text-sm font-normal text-gray-500">(incl. GST)</span>
          </p>
          {product.shortDescription != null && (
            <p className="text-gray-700">{product.shortDescription}</p>
          )}
        </div>

        {product.gallery != null && product.gallery.length > 0 && (
          <div className="flex gap-4 overflow-x-auto">
            {product.gallery.map((item, index) => {
              const img =
                item.image != null && typeof item.image !== "number" ? (item.image as Media) : null;

              if (img?.url == null) {
                return null;
              }

              return (
                <div
                  key={item.id ?? index}
                  className="relative flex-shrink-0 w-40 h-40 overflow-hidden rounded"
                >
                  <Image
                    src={img.url}
                    alt={item.alt ?? img.alt}
                    fill
                    className="object-cover"
                    sizes="160px"
                  />
                </div>
              );
            })}
          </div>
        )}

        {isPurchasable ? (
          <QuantityForm productSlug={product.slug} maxQuantity={product.maxQuantity} />
        ) : (
          <p className="text-gray-500">Currently unavailable.</p>
        )}
      </div>
    </SideBySide>
  );
}
