import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import type { Media } from "@/payload-types";
import { siteMetadata, siteNav } from "@/app/(frontend)/site-config";
import { SideBySide } from "@/components/SideBySide";
import { formatNZD } from "@/lib/formatNZD";
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

  return (
    <SideBySide nav={siteNav}>
      <div className="space-y-8">
        <h1 className="text-3xl font-medium">Shop</h1>
        {docs.length === 0 ? (
          <p>No products available.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((product) => {
                const image =
                  product.featuredImage != null && typeof product.featuredImage !== "number"
                    ? (product.featuredImage as Media)
                    : null;

                return (
                  <article key={product.id} className="flex flex-col gap-3">
                    {image?.url != null && (
                      <div className="relative aspect-square overflow-hidden rounded">
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
                      <Link
                        href={`/products/${product.slug}`}
                        className="text-lg font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                      {product.shortDescription != null && (
                        <p className="text-sm text-gray-600">{product.shortDescription}</p>
                      )}
                      <p className="text-sm font-medium">{formatNZD(product.unitAmountNZD)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
            {(hasPrevPage || hasNextPage) && (
              <nav className="flex gap-4" aria-label="Pagination">
                {hasPrevPage && (
                  <Link
                    href={`/products?page=${page - 1}`}
                    className="px-3 py-1 border border-gray-300 rounded hover:border-gray-900 transition-colors"
                  >
                    Previous
                  </Link>
                )}
                {hasNextPage && (
                  <Link
                    href={`/products?page=${page + 1}`}
                    className="px-3 py-1 border border-gray-300 rounded hover:border-gray-900 transition-colors"
                  >
                    Next
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
