import { For, Match, Show, Switch, createSignal } from "solid-js";
import { Effect } from "effect";
import { runClient } from "./lib/api";
import { createSession, signOut } from "./lib/session";
import type { ContentKind } from "./lib/content";
import { SignInButton } from "./components/SignInButton";
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
  const { session, reloadSession } = createSession();
  const [view, setView] = createSignal<View>({ name: "list" });
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const navigate = props.navigate ?? assignUrl;

  const onSignOut = (): void => {
    setMenuOpen(false);
    void runClient(
      signOut().pipe(
        Effect.tap(() => Effect.sync(reloadSession)),
        Effect.catch(() => Effect.sync(() => setError("Sign out failed"))),
      ),
    );
  };

  return (
    <main class="editor-shell">
      <Show when={error()}>{(message) => <p class="error">{message()}</p>}</Show>
      <Switch>
        <Match when={session() === undefined}>
          <p>Loading…</p>
        </Match>
        <Match when={session() === null}>
          <div class="signin-view">
            <h1 class="signin-title">Camus</h1>
            <SignInButton onError={(message) => setError(message)} navigate={navigate} />
          </div>
        </Match>
        <Match when={session()}>
          {(current) => (
            <div>
              <nav class="editor-nav">
                <h1 class="editor-title">Camus</h1>
                <div class="editor-tabs">
                  <For each={TABS}>
                    {(item) => (
                      <button
                        type="button"
                        class={tabForView(view()) === item.tab ? "editor-tab on" : "editor-tab"}
                        aria-current={tabForView(view()) === item.tab ? "page" : undefined}
                        onClick={() => setView(viewForTab(item.tab))}
                      >
                        {item.label}
                      </button>
                    )}
                  </For>
                </div>
                <div class="editor-user">
                  <button
                    type="button"
                    class="avatar-button"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen() ? "true" : "false"}
                    aria-label="Account"
                    onClick={() => setMenuOpen(!menuOpen())}
                  >
                    <Avatar name={current().user.name} email={current().user.email} />
                  </button>
                  <Show when={menuOpen()}>
                    <button
                      type="button"
                      class="avatar-backdrop"
                      aria-label="Close account menu"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div class="avatar-menu" role="menu">
                      <span>Signed in as {current().user.email}</span>
                      <button
                        type="button"
                        role="menuitem"
                        class="signout-button"
                        onClick={onSignOut}
                      >
                        Sign out
                      </button>
                    </div>
                  </Show>
                </div>
              </nav>
              <Switch>
                <Match when={view().name === "list"}>
                  <PostList onEdit={(kind, slug) => setView({ name: "edit", kind, slug })} />
                </Match>
                <Match when={view().name === "categories"}>
                  <CategoriesView onBack={() => setView({ name: "list" })} />
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
