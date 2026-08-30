import { callAdapter, runAdapterRequest } from "~/libs/adapter";

export function fetchPosts(page: number, pageSize: number) {
  return runAdapterRequest(() => callAdapter().payload.posts.get({ query: { page, pageSize } }));
}

export function fetchPostBySlug(slug: string) {
  return runAdapterRequest(() => callAdapter().payload.posts({ slug }).get());
}

export function fetchWorks() {
  return runAdapterRequest(() => callAdapter().payload.works.get());
}

export function fetchWorkBySlug(slug: string) {
  return runAdapterRequest(() => callAdapter().payload.works({ slug }).get());
}

export function fetchProducts() {
  return runAdapterRequest(() => callAdapter().polar.products.get());
}

export function fetchProduct(productId: string) {
  return runAdapterRequest(() => callAdapter().polar.products({ productId }).get());
}

export function createCustomer(input: { email: string; name?: string; externalId: string }) {
  return runAdapterRequest(() => callAdapter().polar.customers.post(input));
}

export function fetchChannelContents(slug: string, per: number) {
  return runAdapterRequest(() =>
    callAdapter().arena.channels({ slug }).contents.get({ query: { per } }),
  );
}
