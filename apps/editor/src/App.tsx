import { Match, Show, Switch, createEffect, createSignal, onCleanup, onSettled } from "solid-js";
import { Effect } from "effect";
import { Banner } from "@tom/ui/tomui/banner";
import { Loader } from "@tom/ui/tomui/loader";
import { DropdownMenu } from "@tom/ui/tomui/dropdown";
import { Tabs } from "@tom/ui/tomui/tabs";
import { useColorMode } from "@tom/ui/tomui/color-mode";
import { runClient } from "./lib/api";
import { createSession, documentTitle, signOut } from "./lib/session";
import type { ContentKind } from "./lib/content";
import { SignInButton } from "./components/SignInButton";
import { CamusLogo } from "./components/CamusLogo";
import { Avatar } from "./components/Avatar";
import { PostList } from "./components/PostList";
import { EditorView } from "./components/EditorView";
import { CategoriesView } from "./components/CategoriesView";
import { MediaView } from "./components/MediaView";

type View =
  | { readonly name: "list" }
  | { readonly name: "edit"; readonly kind: ContentKind; readonly slug: string | null }
  | { readonly name: "categories" }
  | { readonly name: "media" };

type Tab = "content" | "categories" | "media";

const tabForView = (view: View): Tab => {
  if (view.name === "categories") return "categories";
  if (view.name === "media") return "media";
  return "content";
};

const TABS: ReadonlyArray<{ readonly tab: Tab; readonly label: string }> = [
  { tab: "content", label: "Content" },
  { tab: "categories", label: "Categories" },
  { tab: "media", label: "Media" },
];

const viewForTab = (tab: Tab): View => {
  if (tab === "categories") return { name: "categories" };
  if (tab === "media") return { name: "media" };
  return { name: "list" };
};

const assignUrl = (url: string): void => window.location.assign(url);

export const App = (props: { navigate?: (url: string) => void }) => {
  useColorMode();
  const { session, reloadSession } = createSession();
  const [view, setView] = createSignal<View>({ name: "list" });
  const [error, setError] = createSignal<string | undefined>(undefined);
  const navigate = props.navigate ?? assignUrl;

  onSettled(() => {
    document.title = documentTitle();
  });

  // The list toolbar sticks below the header, so publish the header
  // height for its sticky offset. The nav mounts only after sign-in
  // resolves, so track the session: the effect re-runs post-commit once
  // the nav exists. Layout never depends on the value.
  createEffect(
    () => session(),
    () => {
      const nav = document.querySelector(".editor-nav");
      if (!(nav instanceof HTMLElement)) return;
      const sync = (): void => {
        document.documentElement.style.setProperty("--editor-nav-h", `${nav.offsetHeight}px`);
      };
      sync();
      const observer = new ResizeObserver(sync);
      observer.observe(nav);
      onCleanup(() => observer.disconnect());
    },
  );

  const onSignOut = (): void => {
    void runClient(
      signOut().pipe(
        Effect.tap(() => Effect.sync(reloadSession)),
        Effect.catch(() => Effect.sync(() => setError("Sign out failed"))),
      ),
    );
  };

  const wide = (): boolean =>
    view().name === "edit" || view().name === "categories" || view().name === "media";

  return (
    <main class={`editor-shell${wide() ? " editor-shell-wide" : ""}`}>
      <Show when={error()}>{(message) => <Banner variant="error" description={message()} />}</Show>
      <Switch>
        <Match when={session() === undefined}>
          <p class="flex items-center gap-2">
            <Loader size="sm" /> Loading…
          </p>
        </Match>
        <Match when={session() === null}>
          <div class="signin-view">
            <CamusLogo />
            <h1 class="signin-title">Camus</h1>
            <SignInButton onError={(message) => setError(message)} navigate={navigate} />
          </div>
        </Match>
        <Match when={session()}>
          {(current) => (
            <div>
              <nav class="editor-nav">
                <div class="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                  <h1 class="editor-title">Camus</h1>
                  <Tabs
                    variant="underline"
                    value={tabForView(view())}
                    onValueChange={(value) =>
                      setView(viewForTab(TABS.find((item) => item.tab === value)?.tab ?? "content"))
                    }
                    tabs={TABS.map((item) => ({ value: item.tab, label: item.label }))}
                  />
                </div>
                <div class="editor-user">
                  <DropdownMenu>
                    <DropdownMenu.Trigger
                      class="cursor-pointer rounded-full border-0 bg-transparent p-0"
                      aria-label="Account"
                    >
                      <Avatar name={current().user.name} email={current().user.email} />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Label>Signed in as {current().user.email}</DropdownMenu.Label>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item variant="danger" onClick={onSignOut}>
                        Sign out
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </div>
              </nav>
              <Switch>
                <Match when={view().name === "list"}>
                  <PostList onEdit={(kind, slug) => setView({ name: "edit", kind, slug })} />
                </Match>
                <Match when={view().name === "categories"}>
                  <CategoriesView />
                </Match>
                <Match when={view().name === "media"}>
                  <MediaView onEdit={(kind, slug) => setView({ name: "edit", kind, slug })} />
                </Match>
                <Match when={view().name === "edit" ? view() : false}>
                  {(edit) => {
                    const current = edit();
                    return current.name === "edit" ? (
                      <EditorView
                        kind={current.kind}
                        slug={current.slug}
                        onExit={() => setView({ name: "list" })}
                      />
                    ) : null;
                  }}
                </Match>
              </Switch>
            </div>
          )}
        </Match>
      </Switch>
    </main>
  );
};
