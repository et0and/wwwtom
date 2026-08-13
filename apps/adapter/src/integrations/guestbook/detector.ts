import { Effect } from "effect";
import { NodeinfoError } from "@tom/types/errors";

const NODEINFO_VERSIONS = {
  "1.0": "http://nodeinfo.diaspora.software/ns/schema/1.0",
  "2.0": "http://nodeinfo.diaspora.software/ns/schema/2.0",
  "2.1": "http://nodeinfo.diaspora.software/ns/schema/2.1",
} as const;

type Links = {
  links: Array<{ href: string; rel: string }>;
};

type NodeinfoData = {
  software: { name: string };
  metadata: { upstream?: { name: string } };
};

export type SNSType = "mastodon" | "pleroma" | "friendica" | "firefish" | "gotosocial" | "pixelfed";

const detectFromNodeinfo = (
  software: NodeinfoData["software"],
  metadata: NodeinfoData["metadata"],
): Effect.Effect<SNSType, NodeinfoError> => {
  const softwareMap = {
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
  } as const;

  const detected = softwareMap[software.name as keyof typeof softwareMap];
  if (detected) return Effect.succeed(detected);

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

  const data = yield* Effect.tryPromise({
    try: () => res.json() as Promise<NodeinfoData>,
    catch: (error) =>
      new NodeinfoError({
        message: `Failed to parse nodeinfo ${version} data`,
        cause: error,
      }),
  });

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

  const data = yield* Effect.tryPromise({
    try: () => res.json() as Promise<Links>,
    catch: (error) =>
      new NodeinfoError({
        message: "Failed to parse nodeinfo response",
        cause: error,
      }),
  });

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
