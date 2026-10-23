import { Effect, Schema } from "effect";
import { NodeinfoError } from "@tom/types/errors";

const NODEINFO_VERSIONS = {
  "2.0": "http://nodeinfo.diaspora.software/ns/schema/2.0",
  "2.1": "http://nodeinfo.diaspora.software/ns/schema/2.1",
} as const;

const NodeinfoLinksSchema = Schema.Struct({
  links: Schema.Array(Schema.Struct({ href: Schema.String, rel: Schema.String })),
});

const NodeinfoDocumentSchema = Schema.Struct({
  software: Schema.Struct({ name: Schema.String }),
  metadata: Schema.Struct({
    upstream: Schema.optional(Schema.Struct({ name: Schema.optional(Schema.String) })),
  }).pipe(Schema.withDecodingDefault(Effect.succeed({}))),
});

type NodeinfoDocument = Schema.Schema.Type<typeof NodeinfoDocumentSchema>;

export type SNSType = "mastodon" | "pleroma" | "friendica" | "firefish" | "gotosocial" | "pixelfed";

const detectFromNodeinfo = (
  software: NodeinfoDocument["software"],
  metadata: NodeinfoDocument["metadata"],
): Effect.Effect<SNSType, NodeinfoError> => {
  // oxlint-disable-next-line anti-slop/no-known-value-widening -- open lookup keyed by runtime software name
  const softwareMap: Record<string, SNSType> = {
    akkoma: "pleroma",
    firefish: "firefish",
    friendica: "friendica",
    gotosocial: "gotosocial",
    hometown: "mastodon",
    iceshrimp: "firefish",
    mastodon: "mastodon",
    pixelfed: "pixelfed",
    pleroma: "pleroma",
    sharkey: "mastodon",
  };

  const detected = softwareMap[software.name];
  if (detected !== undefined) return Effect.succeed(detected);

  if (metadata.upstream?.name?.toLowerCase() === "mastodon") {
    return Effect.succeed("mastodon");
  }

  return new NodeinfoError({ message: "Unknown SNS" });
};

const fetchNodeinfoVersion = Effect.fn("fetchNodeinfoVersion")(function* (
  href: string,
  version: string,
) {
  const res = yield* Effect.tryPromise({
    try: () =>
      fetch(href, {
        signal: AbortSignal.timeout(20000),
      }),
    catch: (error) =>
      new NodeinfoError({
        message: `Failed to fetch nodeinfo ${version} data`,
        cause: error,
      }),
  });

  if (!res.ok) {
    return yield* new NodeinfoError({
      message: `Failed to fetch nodeinfo data: ${res.status} ${res.statusText}`,
    });
  }

  const payload: unknown = yield* Effect.tryPromise({
    try: () => res.json(),
    catch: (error) =>
      new NodeinfoError({
        message: `Failed to parse nodeinfo ${version} data`,
        cause: error,
      }),
  });

  const data = yield* Schema.decodeUnknownEffect(NodeinfoDocumentSchema)(payload).pipe(
    Effect.mapError(
      (cause) =>
        new NodeinfoError({
          message: `Failed to parse nodeinfo ${version} data`,
          cause,
        }),
    ),
  );

  return data;
});

export const detector = Effect.fn("detector")(function* (url: string) {
  const res = yield* Effect.tryPromise({
    try: () =>
      fetch(`${url}/.well-known/nodeinfo`, {
        signal: AbortSignal.timeout(20000),
      }),
    catch: (error) =>
      new NodeinfoError({
        message: "Failed to fetch nodeinfo endpoint",
        cause: error,
      }),
  });

  if (!res.ok) {
    return yield* new NodeinfoError({
      message: `Failed to fetch nodeinfo: ${res.status} ${res.statusText}`,
    });
  }

  const payload: unknown = yield* Effect.tryPromise({
    try: () => res.json(),
    catch: (error) =>
      new NodeinfoError({
        message: "Failed to parse nodeinfo response",
        cause: error,
      }),
  });

  const data = yield* Schema.decodeUnknownEffect(NodeinfoLinksSchema)(payload).pipe(
    Effect.mapError(
      (cause) =>
        new NodeinfoError({
          message: "Failed to parse nodeinfo response",
          cause,
        }),
    ),
  );

  const link = data.links.find(
    (l) => l.rel === NODEINFO_VERSIONS["2.0"] || l.rel === NODEINFO_VERSIONS["2.1"],
  );

  if (!link) {
    return yield* new NodeinfoError({ message: "Could not find nodeinfo" });
  }

  const version = link.rel === NODEINFO_VERSIONS["2.1"] ? "2.1" : "2.0";
  const nodeinfo = yield* fetchNodeinfoVersion(link.href, version);
  return yield* detectFromNodeinfo(nodeinfo.software, nodeinfo.metadata);
});
