import { Loading, Show, createSignal } from "solid-js";
import { createRouter, useParams } from "@solidjs/router";
import { QueryClientProvider, useQuery } from "@tanstack/solid-query";
import { HttpStatus } from "@tom/constants/http";
import type { CmsPost } from "@tom/schemas/cms";
import { HttpError } from "@tom/types/errors";
import { Metadata } from "@tom/ui/Meta";
import { Banner } from "@tom/ui/banner";
import { Breadcrumbs } from "@tom/ui/breadcrumbs";
import { Loader } from "@tom/ui/loader";
import { Pagination } from "@tom/ui/pagination";
import { getAdapterBaseUrl } from "./lib/api";
import { getQueryClient } from "./lib/query-client";
import {
  PAGES_CATEGORY,
  fetchAbout,
  fetchCategories,
  fetchPost,
  fetchPosts,
  formatPublishedDate,
  isPage,
} from "./lib/posts";
import { Nav } from "./components/Nav";
import { CategoryFilter } from "./components/CategoryFilter";
import { PostList } from "./components/PostList";
import "./app.css";

const SOPHIE_DESCRIPTION = "Sophie — writing";

// Static per bundle: the adapter origin is inlined at build time on the
// client and read from worker env on the server, never per request.
const SOPHIE_BRAND = {
  suffix: "Sophie",
  ogBase: getAdapterBaseUrl(),
  template: "sophie",
};

const About = () => {
  const aboutQuery = useQuery(() => ({
    queryKey: ["sophie-about"],
    queryFn: fetchAbout,
  }));

  return (
    <main>
      <Metadata
        title="About"
        metaType="description"
        metaContent={SOPHIE_DESCRIPTION}
        brand={SOPHIE_BRAND}
      />
      <div class="sophie-crumbs">
        <Breadcrumbs size="sm" items={[{ label: "Home", href: "/" }, { label: "About" }]} />
      </div>
      <h1 class="sophie-title">About</h1>
      <Loading
        fallback={
          <p class="flex items-center gap-2">
            <Loader size="sm" /> Loading…
          </p>
        }
      >
        <Show when={aboutQuery.isError}>
          <Banner variant="error" description={aboutQuery.error?.message ?? "Load failed"} />
        </Show>
        <Show when={aboutQuery.data} fallback={<p>Nothing here yet.</p>}>
          {(post) => (
            // post.html is rendered at write time from a validated Tiptap
            // doc via renderTiptapHtml (escaped, unsafe schemes dropped),
            // so innerHTML is safe here. Pinned by html.test.ts.
            <div class="sophie-body" innerHTML={post().html} />
          )}
        </Show>
      </Loading>
    </main>
  );
};

const Posts = () => {
  const [activeCategory, setActiveCategory] = createSignal<string | null>(null);
  const [page, setPage] = createSignal(1);

  const postsQuery = useQuery(() => ({
    queryKey: ["sophie-posts", page(), activeCategory()],
    queryFn: () => fetchPosts(page(), activeCategory()),
  }));
  const catsQuery = useQuery(() => ({
    queryKey: ["sophie-categories"],
    queryFn: fetchCategories,
  }));

  // The active filter runs server-side (?category=), so the page window and
  // totalPages already match it. Pages stay hidden client-side: the backend
  // has no exclusion filter and "pages" is a tiny reserved set.
  const visible = (): ReadonlyArray<CmsPost> =>
    (postsQuery.data?.docs ?? []).filter((post) => !isPage(post));
  const totalPages = (): number => postsQuery.data?.totalPages ?? 1;

  return (
    <main>
      <Metadata
        title="Writing"
        metaType="description"
        metaContent={SOPHIE_DESCRIPTION}
        brand={SOPHIE_BRAND}
      />
      <Loading
        fallback={
          <p class="flex items-center gap-2">
            <Loader size="sm" /> Loading…
          </p>
        }
      >
        <Show when={postsQuery.isError}>
          <Banner variant="error" description={postsQuery.error?.message ?? "Load failed"} />
        </Show>
        <CategoryFilter
          categories={(catsQuery.data ?? []).filter((category) => category.slug !== PAGES_CATEGORY)}
          active={activeCategory()}
          onSelect={(slug) => {
            setActiveCategory(slug);
            setPage(1);
          }}
        />
        <PostList posts={visible()} />
        <Show when={totalPages() > 1}>
          <Pagination
            class="mt-4"
            page={page()}
            pageCount={totalPages()}
            onChange={(next) => setPage(next)}
          />
        </Show>
      </Loading>
    </main>
  );
};

const PostDetail = () => {
  const params = useParams();

  const postQuery = useQuery(() => ({
    queryKey: ["sophie-post", params.slug],
    queryFn: () => {
      const slug = params.slug;
      if (!slug) {
        throw new HttpError({
          message: "Missing post slug",
          status: HttpStatus.NotFound,
        });
      }
      return fetchPost(slug);
    },
    // Hold the SSR stream until the post resolves, so the <head> flushes
    // with title/og meta instead of an empty head.
    deferStream: true,
  }));

  return (
    <main>
      {/* No Loading wrapper: the query promise suspends to the outer boundary
        so the SSR stream holds until data resolves and head takes the meta. */}
      <Show
        when={postQuery.data}
        fallback={
          <Show
            when={postQuery.isError}
            fallback={
              <p class="flex items-center gap-2">
                <Loader size="sm" /> Loading…
              </p>
            }
          >
            <Banner variant="error" description={postQuery.error?.message ?? "Load failed"} />
          </Show>
        }
      >
        {(found) => (
          <article>
            <Metadata
              title={found().title}
              metaType="description"
              metaContent={found().summary ?? SOPHIE_DESCRIPTION}
              brand={SOPHIE_BRAND}
              date={formatPublishedDate(found().publishedAt)}
            />
            <div class="sophie-crumbs">
              <Breadcrumbs
                size="sm"
                items={[{ label: "Posts", href: "/" }, { label: found().title }]}
              />
            </div>
            {/* post.html is rendered at write time from a validated Tiptap
              doc via renderTiptapHtml (escaped, unsafe schemes dropped),
              so innerHTML is safe here. Pinned by html.test.ts. */}
            <div class="sophie-body" innerHTML={found().html} />
          </article>
        )}
      </Show>
    </main>
  );
};

const NotFound = () => (
  <main>
    <Metadata
      title="Missing"
      metaType="description"
      metaContent={SOPHIE_DESCRIPTION}
      brand={SOPHIE_BRAND}
    />
    <h1 class="sophie-title">Missing</h1>
    <p>No page lives here.</p>
    <p>
      <a href="/about">About</a>
    </p>
  </main>
);

const ignoredPrefetchError = (): void => {
  // A failed prefetch surfaces through the query's error state — don't let
  // the rejection fail the SSR request.
};
/** Static paths sit before sibling dynamic paths so the matcher prefers them. */
export const Router = createRouter({
  routes: [
    {
      path: "/",
      component: Posts,
      preload: () => {
        void getQueryClient()
          .prefetchQuery({
            queryKey: ["sophie-posts", 1, null],
            queryFn: () => fetchPosts(1, null),
          })
          .catch(ignoredPrefetchError);
        void getQueryClient()
          .prefetchQuery({ queryKey: ["sophie-categories"], queryFn: fetchCategories })
          .catch(ignoredPrefetchError);
      },
    },
    {
      path: "/about",
      component: About,
      preload: () => {
        void getQueryClient()
          .prefetchQuery({ queryKey: ["sophie-about"], queryFn: fetchAbout })
          .catch(ignoredPrefetchError);
      },
    },
    { path: "/posts", component: Posts },
    {
      path: "/posts/:slug",
      component: PostDetail,
      preload: ({ params }) => {
        const slug = params.slug;
        if (slug) {
          void getQueryClient()
            .prefetchQuery({
              queryKey: ["sophie-post", slug],
              queryFn: () => fetchPost(slug),
            })
            .catch(ignoredPrefetchError);
        }
      },
    },
    { path: "*404", component: NotFound },
  ],
});

export const App = () => {
  // On the server each request owns its query cache (locals.queryClient);
  // outside a request scope this is the shared fallback client.
  const client = getQueryClient();

  return (
    <QueryClientProvider client={client}>
      <div class="sophie-shell">
        <Nav />
        <Router>{(props) => <div class="sophie-main">{props.children}</div>}</Router>
        <footer class="sophie-footer">
          <p>All rights reserved</p>
        </footer>
      </div>
    </QueryClientProvider>
  );
};
