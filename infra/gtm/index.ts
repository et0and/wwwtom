import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as Provider from "alchemy/Provider";
import type { ResourceClassLike } from "alchemy/Resource";
import { Account, AccountProvider } from "./account.ts";
import { Container, ContainerProvider } from "./container.ts";
import { GtmCredentialsLive } from "./credentials.ts";
import { Folder, FolderProvider } from "./folder.ts";
import { GtmHttpLive } from "./http.ts";
import { Tag, TagProvider } from "./tag.ts";
import { Trigger, TriggerProvider } from "./trigger.ts";
import { Variable, VariableProvider } from "./variable.ts";
import { Version, VersionProvider } from "./version.ts";
import { Workspace, WorkspaceProvider } from "./workspace.ts";

type GtmResource = Account | Container | Workspace | Tag | Trigger | Variable | Folder | Version;

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
      Variable,
      Folder,
      Version,
    ] as ResourceClassLike<GtmResource>[]),
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        AccountProvider(),
        ContainerProvider(),
        WorkspaceProvider(),
        TagProvider(),
        TriggerProvider(),
        VariableProvider(),
        FolderProvider(),
        VersionProvider(),
      ),
    ),
    Layer.provideMerge(GtmHttpLive),
    Layer.provideMerge(GtmCredentialsLive),
    Layer.provideMerge(FetchHttpClient.layer),
    Layer.orDie,
  );
