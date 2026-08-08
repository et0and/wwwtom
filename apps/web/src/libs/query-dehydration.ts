import { dehydrate, type QueryClient } from "@tanstack/solid-query";

/**
 * Serialize the query cache for the client, escaping "<" so post content
 * containing "</script>" cannot terminate the script element early;
 * JSON.parse decodes it back.
 */
export const serializeDehydratedState = (queryClient: QueryClient): string =>
  JSON.stringify(dehydrate(queryClient)).replace(/</g, "\\u003c");

/**
 * Route preloads register their queries synchronously during render but
 * resolve asynchronously, so wait until every registered query settles before
 * serializing the dehydrated state.
 */
export const waitForQueriesToSettle = async (queryClient: QueryClient): Promise<void> => {
  await Promise.resolve();
  if (queryClient.getQueryCache().getAll().length === 0) return;
  await new Promise<void>((resolve) => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (queryClient.isFetching() === 0) {
        unsubscribe();
        resolve();
      }
    });
    if (queryClient.isFetching() === 0) {
      unsubscribe();
      resolve();
    }
  });
};
