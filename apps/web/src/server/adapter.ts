import { callAdapter, runAdapterRequest, runAdapterRequestOrNull } from "~/libs/adapter";
import type {
  ArenaRef,
  CmsListResponse,
  CmsPost,
  CmsPostSummary,
  CmsWork,
  CmsWorkSummary,
} from "@tom/schemas/cms";

/** Posts index page size, shared by the route and its router preload. */
export const POSTS_PAGE_SIZE = 5;

/** Single post reads carry the adapter-appended arena embeds. */
export type PostWithArena = CmsPost & { readonly arenaBlocks: ReadonlyArray<ArenaRef> };

/** Single work reads carry the adapter-appended arena embeds. */
export type WorkWithArena = CmsWork & { readonly arenaBlocks: ReadonlyArray<ArenaRef> };

export function fetchPosts(
  page: number,
  pageSize: number,
): Promise<CmsListResponse<CmsPostSummary>> {
  return runAdapterRequest(() =>
    callAdapter().content.posts.summary.get({ query: { page, pageSize } }),
  );
}

export function fetchPostBySlug(slug: string): Promise<PostWithArena | null> {
  return runAdapterRequestOrNull(() => callAdapter().content.posts({ slug }).get());
}

export function fetchWorks(): Promise<CmsListResponse<CmsWorkSummary>> {
  return runAdapterRequest(() => callAdapter().content.works.summary.get());
}

export function fetchWorkBySlug(slug: string): Promise<WorkWithArena | null> {
  return runAdapterRequestOrNull(() => callAdapter().content.works({ slug }).get());
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
