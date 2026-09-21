import { callAdapter, runAdapterRequest, runAdapterRequestOrNull } from "~/libs/adapter";
import type { ArenaEntry, ArenaEntryList } from "@tom/schemas/arena-content";

/** Posts index page size, shared by the route and its router preload. */
export const POSTS_PAGE_SIZE = 5;

/** One page of the are.na master channel: title, summary, and order. */
export function fetchPosts(page: number, pageSize: number): Promise<ArenaEntryList> {
  return runAdapterRequest(() =>
    callAdapter().content.arena.posts.get({ query: { page, pageSize } }),
  );
}

/** A published post with its blocks, or null when it is not in the index. */
export function fetchPostBySlug(slug: string): Promise<ArenaEntry | null> {
  return runAdapterRequestOrNull(() => callAdapter().content.arena.posts({ slug }).get());
}

export function fetchWorks(): Promise<ArenaEntryList> {
  return runAdapterRequest(() => callAdapter().content.arena.works.get());
}

export function fetchWorkBySlug(slug: string): Promise<ArenaEntry | null> {
  return runAdapterRequestOrNull(() => callAdapter().content.arena.works({ slug }).get());
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

export function fetchChannel(slug: string) {
  return runAdapterRequest(() => callAdapter().arena.channels({ slug }).get());
}

export function fetchChannelContents(slug: string, per: number) {
  return runAdapterRequest(() =>
    callAdapter().arena.channels({ slug }).contents.get({ query: { per } }),
  );
}
