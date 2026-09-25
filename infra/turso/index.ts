import * as Layer from "effect/Layer";
import * as Provider from "alchemy/Provider";
import type { ResourceClassLike } from "alchemy/Resource";
import { TursoCredentialsLive } from "./credentials.ts";
import { Database, DatabaseProvider } from "./database.ts";
import { DatabaseToken, DatabaseTokenProvider } from "./databaseToken.ts";
import { Group, GroupProvider } from "./group.ts";
import { TursoHttpLive } from "./http.ts";
import { Location, LocationProvider } from "./location.ts";

type TursoResource = Location | Group | Database | DatabaseToken;

class TursoProviders extends Provider.ProviderCollection<TursoProviders>()("Turso") {}

export const providers = () =>
  Layer.effect(
    TursoProviders,
    Provider.collection([
      Location,
      Group,
      Database,
      DatabaseToken,
    ] as ResourceClassLike<TursoResource>[]),
  ).pipe(
    Layer.provide(
      Layer.mergeAll(
        LocationProvider(),
        GroupProvider(),
        DatabaseProvider(),
        DatabaseTokenProvider(),
      ),
    ),
    Layer.provideMerge(TursoHttpLive),
    Layer.provideMerge(TursoCredentialsLive),
    Layer.orDie,
  );
