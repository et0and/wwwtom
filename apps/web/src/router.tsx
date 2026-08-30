import { createRouter } from "@solidjs/router";
import { getQueryClient } from "~/libs/query-client";
import { fetchPostBySlug, fetchPosts, fetchWorks, fetchWorkBySlug } from "~/server/adapter";
import NotFound from "~/routes/[...404]";
import About from "~/routes/about";
import Accessibility from "~/routes/accessibility";
import Guestbook, { fetchEntries } from "~/routes/guestbook";
import Home from "~/routes/index";
import PostPage from "~/routes/posts/[slug]";
import PostsHome from "~/routes/posts/index";
import Products from "~/routes/products";
import Purchase from "~/routes/purchase/[productId]";
import Thanks from "~/routes/thanks";
import WorkPage from "~/routes/work/[slug]";
import WorkHome from "~/routes/work/index";
import Kawara from "~/routes/work/wwwork/kawara";
import Hold from "~/routes/work/wwwork/hold";
import Worktable from "~/routes/worktable";

const ignoredPrefetchError = (): void => {
  // A failed prefetch surfaces through the query's error state — don't let
  // the rejection fail the SSR request.
};
/** The app's route table (replaces SolidStart FileRoutes). Static paths are
 * declared before sibling dynamic paths so the matcher prefers them. */
export const Router = createRouter({
  routes: [
    { path: "/", component: Home },
    { path: "/about", component: About },
    { path: "/accessibility", component: Accessibility },
    { path: "/thanks", component: Thanks },
    {
      path: "/guestbook",
      component: Guestbook,
      preload: () => {
        getQueryClient()
          .prefetchQuery({ queryKey: ["guestbook-entries"], queryFn: fetchEntries })
          .catch(ignoredPrefetchError);
      },
    },
    {
      path: "/posts",
      component: PostsHome,
      preload: ({ location }) => {
        const page = Number(location.query.page) || 1;
        getQueryClient()
          .prefetchQuery({ queryKey: ["posts", page], queryFn: () => fetchPosts(page, 5) })
          .catch(ignoredPrefetchError);
      },
    },
    {
      path: "/posts/:slug",
      component: PostPage,
      preload: ({ params }) => {
        if (params.slug) {
          getQueryClient()
            .prefetchQuery({
              queryKey: ["post", params.slug],
              queryFn: () => fetchPostBySlug(params.slug as string),
            })
            .catch(ignoredPrefetchError);
        }
      },
    },
    {
      path: "/work",
      component: WorkHome,
      preload: () => {
        getQueryClient()
          .prefetchQuery({ queryKey: ["works"], queryFn: () => fetchWorks() })
          .catch(ignoredPrefetchError);
      },
    },
    {
      path: "/work/:slug",
      component: WorkPage,
      preload: ({ params }) => {
        if (params.slug) {
          getQueryClient()
            .prefetchQuery({
              queryKey: ["work", params.slug],
              queryFn: () => fetchWorkBySlug(params.slug as string),
            })
            .catch(ignoredPrefetchError);
        }
      },
    },
    { path: "/work/wwwork/hold", component: Hold },
    { path: "/work/wwwork/kawara", component: Kawara },
    { path: "/products", component: Products },
    { path: "/purchase/:productId", component: Purchase },
    { path: "/worktable", component: Worktable },
    { path: "*404", component: NotFound },
  ],
});
