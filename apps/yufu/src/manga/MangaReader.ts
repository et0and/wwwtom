import { Command, Head, Subscription, UiSchema } from "@effect/ui";
import { Html } from "@effect/ui/html";
import { Effect, Schema, Stream } from "effect";

import { adapterUrl } from "../auth/session";
import { decodeArchive } from "./archive";
import { MangaManifestSchema } from "./manifest";

export const ReaderMessage = UiSchema.TaggedEnum({
  LoadRequested: { id: Schema.String },
  Loaded: { pages: Schema.Array(Schema.String) },
  Failed: { message: Schema.String },
  Next: {},
  Prev: {},
});

const load = (id: string): Effect.Effect<ReadonlyArray<string>, string> =>
  Effect.gen(function* () {
    const manifestResponse = yield* Effect.tryPromise({
      try: () => fetch(`${adapterUrl()}/manga/manifest`, { credentials: "include" }),
      catch: () => "manifest_request_failed",
    });
    if (!manifestResponse.ok) return yield* Effect.fail("manifest_request_failed");
    const manifestJson = yield* Effect.tryPromise({
      try: () => manifestResponse.json(),
      catch: () => "invalid_manifest",
    });
    const manifest = Schema.decodeUnknownOption(MangaManifestSchema)(manifestJson);
    if (manifest._tag === "None") return yield* Effect.fail("invalid_manifest");
    const title = manifest.value.titles.find((candidate) => candidate.id === id);
    if (title === undefined) return yield* Effect.fail("manga_not_found");

    const archiveResponse = yield* Effect.tryPromise({
      try: () =>
        fetch(`${adapterUrl()}/manga/archive/${encodeURIComponent(id)}`, {
          credentials: "include",
        }),
      catch: () => "archive_request_failed",
    });
    if (!archiveResponse.ok) return yield* Effect.fail("archive_request_failed");
    const bytes = yield* Effect.tryPromise({
      try: () => archiveResponse.arrayBuffer(),
      catch: () => "archive_read_failed",
    });
    const pages = yield* Effect.tryPromise({
      try: () => decodeArchive(bytes, title.archiveKey),
      catch: () => "archive_decode_failed",
    });
    return pages.map((page) =>
      URL.createObjectURL(new Blob([new Uint8Array(page)], { type: "image/jpeg" })),
    );
  });

export const LoadArchive = Command.make("LoadArchive", { args: { id: Schema.String } }, ({ id }) =>
  load(id).pipe(
    Effect.map((pages) => ReaderMessage.Loaded({ pages })),
    Effect.catch((message) => Effect.succeed(ReaderMessage.Failed({ message }))),
  ),
);

export const MangaReader = Html.component({
  name: "MangaReader",
  props: Schema.Struct({ id: Schema.String }),
  model: Schema.Struct({
    pages: Schema.Array(Schema.String),
    index: Schema.Number,
    error: Schema.NullOr(Schema.String),
  }),
  message: ReaderMessage,
}).make({
  init: () => ({ pages: [], index: 0, error: null }),
  update: {
    LoadRequested: ($, { id }) => $.run(LoadArchive.make({ id })),
    Loaded: ($, { pages }) => ({ pages, index: 0, error: null }),
    Failed: ($, { message }) => ({ ...$.model, error: message }),
    Next: ($) => ({ ...$.model, index: Math.min($.model.index + 1, $.model.pages.length - 1) }),
    Prev: ($) => ({ ...$.model, index: Math.max($.model.index - 1, 0) }),
  },
  subscriptions: ({ props }) => [
    Subscription.make("load-archive", [props.id], (deps) =>
      Stream.make(ReaderMessage.LoadRequested({ id: deps[0] })),
    ),
  ],
  head: () => [Head.title("Reader")],
  view: (h, model) =>
    h.main.children(
      h.h1.children("Reader"),
      model.error !== null && h.p.children(model.error),
      model.pages.length === 0
        ? h.p.children("Loading pages...")
        : h.div.children(
            h.img.attr("src", model.pages[model.index] ?? "").attr("alt", "Manga page"),
            h.p.children(`Page ${model.index + 1} of ${model.pages.length}`),
            h.button.on("click", ReaderMessage.Prev()).children("Previous"),
            h.button.on("click", ReaderMessage.Next()).children("Next"),
          ),
    ),
});
