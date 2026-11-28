import { Head } from "@effect/ui";
import { Html } from "@effect/ui/html";
import { Schema } from "effect";
import { AsyncResult } from "effect/reactivity";

import { Session } from "../auth/session";
import { SignIn, SignInMessage } from "../auth/sign-in";
import { AppRoute } from "../routes";
import { MangaManifest } from "./manifest";

export const MangaIndex = Html.component({
  name: "MangaIndex",
  model: Schema.Struct({ error: Schema.NullOr(Schema.String) }),
  message: SignInMessage,
  queries: {
    session: { query: Session, args: () => ({}) },
    manifest: { query: MangaManifest, args: () => ({}) },
  },
}).make({
  init: () => ({ error: null }),
  update: {
    ClickedSignIn: ($) => $.run(SignIn.make({})),
    Started: () => ({ error: null }),
    Failed: () => ({ error: "Sign-in failed" }),
  },
  head: () => [Head.title("Manga")],
  view: (h, model) =>
    h.main.children(
      h.h1.children("Manga"),
      AsyncResult.match(h.queries.session, {
        onInitial: () => h.p.children("Loading session..."),
        onFailure: () => h.p.children("Session check failed"),
        onSuccess: (session) =>
          session.value === null
            ? h.div.children(
                h.p.children("Sign in with GitHub to read manga."),
                h.button.on("click", SignInMessage.ClickedSignIn()).children("Sign in with GitHub"),
                model.error !== null && h.p.children(model.error),
              )
            : AsyncResult.match(h.queries.manifest, {
                onInitial: () => h.p.children("Loading titles..."),
                onFailure: () => h.p.children("Could not load the manga list"),
                onSuccess: (manifest) =>
                  h.ul.children(
                    manifest.value.titles.map((title) =>
                      h.li.children(
                        h.a
                          .attr(
                            "href",
                            `#${AppRoute.print(AppRoute.MangaReader({ params: { id: title.id } }))}`,
                          )
                          .children(title.title),
                      ),
                    ),
                  ),
              }),
      }),
    ),
});
