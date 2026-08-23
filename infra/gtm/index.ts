import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as Provider from "alchemy/Provider";
import type { ResourceClassLike } from "alchemy/Resource";
import { Account, AccountProvider } from "./account.ts";
import { Container, ContainerProvider } from "./container.ts";
import { GtmCredentialsLive } from "./credentials.ts";
import { GtmHttpLive } from "./http.ts";
import { Tag, TagProvider } from "./tag.ts";
import { Trigger, TriggerProvider } from "./trigger.ts";
import { Workspace, WorkspaceProvider } from "./workspace.ts";

type GtmResource = Account | Container | Workspace | Tag | Trigger;

class GtmProviders extends Provider.ProviderCollection<GtmProviders>()("Gtm") {}

export const providers = () =>
  Layer.effect(
    GtmProviders,
    Provider.collection([
      Account,
      Container,
      Workspace,
      Tag,
      Trigger,
    ] as ResourceClassLike<GtmResource>[]),
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        AccountProvider(),
        ContainerProvider(),
        WorkspaceProvider(),
        TagProvider(),
        TriggerProvider(),
      ),
    ),
    Layer.provideMerge(GtmHttpLive),
    Layer.provideMerge(GtmCredentialsLive),
    Layer.provideMerge(FetchHttpClient.layer),
    Layer.orDie,
  );
