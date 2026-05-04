import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Media } from "@/payload-types";
import { storefrontCopy } from "@/app/(frontend)/copy";
import { siteNav } from "@/app/(frontend)/site-config";
import { SideBySide } from "@/components/SideBySide";
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
    description: product.meta?.description ?? undefined,
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
  const copy = storefrontCopy.productDetail;

  if (product == null) {
    notFound();
  }

  const featuredImage =
    product.featuredImage != null && typeof product.featuredImage !== "number"
      ? (product.featuredImage as Media)
      : null;

  return (
    <SideBySide nav={siteNav}>
      <div className="section-stack">
        <section className="grid gap-8 lg:grid-cols-[1.25fr_0.9fr] lg:items-start">
          <div className="space-y-5">
            <p className="label">{copy.eyebrow}</p>
            <h1 className="heading-section text-[2.5rem]">{product.name}</h1>
            {product.priceLabel != null && product.priceLabel.length > 0 && (
              <p className="text-lg font-semibold">{product.priceLabel}</p>
            )}
            <div className="surface-card space-y-3">
              <h2 className="text-xl">{copy.purchaseHeading}</h2>
              <p className="text-sm text-[var(--color-ink-muted)]">{copy.purchaseBody}</p>
              {product.isAvailable === true &&
              product.stripePaymentLink != null &&
              product.stripePaymentLink.length > 0 ? (
                <a
                  href={product.stripePaymentLink}
                  className="button-primary inline-flex"
                  rel="noopener noreferrer"
                >
                  {copy.submitLabel}
                </a>
              ) : (
                <p className="feedback-error">{copy.unavailable}</p>
              )}
            </div>
          </div>

          {featuredImage?.url != null && (
            <div className="relative aspect-[4/5] w-full overflow-hidden border border-[var(--color-border)]">
              <Image
                src={featuredImage.url}
                alt={featuredImage.alt}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 38vw"
              />
            </div>
          )}
        </section>

        {/*{product.gallery != null && product.gallery.length > 0 && (
          <section className="space-y-3" aria-label={copy.galleryLabel}>
            <hr className="editorial-divider" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {product.gallery.map((item, index) => {
                const img =
                  item.image != null && typeof item.image !== 'number'
                    ? (item.image as Media)
                    : null

                if (img?.url == null) {
                  return null
                }

                return (
                  <div
                    key={item.id ?? index}
                    className="relative aspect-square overflow-hidden border border-[var(--color-border)]"
                  >
                    <Image
                      src={img.url}
                      alt={item.alt ?? img.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 20vw"
                    />
                  </div>
                )
              })}
            </div>
          </section>
        )}*/}
      </div>
    </SideBySide>
  );
}
