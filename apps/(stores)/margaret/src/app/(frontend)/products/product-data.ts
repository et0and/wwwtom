import config from "@payload-config";
import { getPayload } from "payload";
import { cache } from "react";

export const PRODUCTS_PER_PAGE = 12;

export const getPublishedProductsPage = cache(async (page: number) => {
  const payload = await getPayload({ config });
  return payload.find({
    collection: "products",
    where: {
      and: [{ _status: { equals: "published" } }, { isAvailable: { equals: true } }],
    },
    sort: "-updatedAt",
    depth: 2,
    page,
    limit: PRODUCTS_PER_PAGE,
  });
});

export const getPublishedProductBySlug = cache(async (slug: string) => {
  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "products",
    where: {
      and: [{ slug: { equals: slug } }, { _status: { equals: "published" } }],
    },
    depth: 2,
    limit: 1,
  });
  return result.docs[0] ?? null;
});
