import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import type { Media } from "@/payload-types";
import { storefrontCopy } from "@/app/(frontend)/copy";
import { siteMetadata, siteNav } from "@/app/(frontend)/site-config";
import { SideBySide } from "@/components/SideBySide";
import { getPublishedProductsPage } from "./product-data";

export const metadata: Metadata = {
  title: { ...siteMetadata.title, default: "Shop" },
  description: siteMetadata.description,
};

interface ProductsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function ProductsPage(props: ProductsPageProps) {
  const query = await props.searchParams;
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const result = await getPublishedProductsPage(page);
  const { docs, hasPrevPage, hasNextPage } = result;
  const copy = storefrontCopy.products;

  return (
    <SideBySide nav={siteNav}>
      <div className="section-stack">
        <section className="space-y-4">
          <p className="label">{copy.eyebrow}</p>
          <h1 className="heading-display">{copy.title}</h1>
          <p className="body-copy">{copy.intro}</p>
        </section>

        {docs.length === 0 ? (
          <p className="surface-card text-sm text-[var(--color-ink-muted)]">{copy.emptyState}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((product) => {
                const image =
                  product.featuredImage != null && typeof product.featuredImage !== "number"
                    ? (product.featuredImage as Media)
                    : null;

                return (
                  <article key={product.id} className="surface-card flex flex-col gap-3">
                    {image?.url != null && (
                      <div className="relative aspect-square overflow-hidden border border-[var(--color-border)]">
                        <Image
                          src={image.url}
                          alt={image.alt}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <Link href={`/products/${product.slug}`} className="link text-xl font-medium">
                        {product.name}
                      </Link>

                      {product.priceLabel != null && product.priceLabel.length > 0 && (
                        <p className="text-sm font-semibold text-[var(--color-ink)]">
                          {product.priceLabel}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {(hasPrevPage || hasNextPage) && (
              <nav className="flex gap-3" aria-label="Pagination">
                {hasPrevPage && (
                  <Link href={`/products?page=${page - 1}`} className="button-secondary">
                    {copy.pagination.previous}
                  </Link>
                )}
                {hasNextPage && (
                  <Link href={`/products?page=${page + 1}`} className="button-secondary">
                    {copy.pagination.next}
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </SideBySide>
  );
}
