import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Provider from "alchemy/Provider";
import type { ResourceClass, ResourceClassLike, ResourceLike } from "alchemy/Resource";
import { Stack } from "alchemy/Stack";
import type { StackSpec } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { makeFakeGtmHttpLayer, makeFakeState, type FakeState } from "../http.ts";

const testStack: Omit<StackSpec, "output"> = {
  name: "wwwtom-gtm",
  stage: "test",
  resources: {},
  bindings: {},
  actions: {},
};

export const testSession = {
  emit: () => Effect.void,
  done: () => Effect.void,
  note: () => Effect.void,
};

export const makeTestLayer = (state: ReturnType<typeof makeFakeState>) =>
  Layer.mergeAll(
    makeFakeGtmHttpLayer(state),
    Layer.succeed(Stack, testStack),
    Layer.succeed(Stage, "test"),
  );

type GtmProviderService<R extends ResourceLike> = Omit<
  Provider.ProviderService<R>,
  "diff" | "read" | "reconcile" | "delete"
> & {
  diff: NonNullable<Provider.ProviderService<R>["diff"]>;
  read: NonNullable<Provider.ProviderService<R>["read"]>;
  reconcile: NonNullable<Provider.ProviderService<R>["reconcile"]>;
  delete: NonNullable<Provider.ProviderService<R>["delete"]>;
};

// alchemy's findProvider rejects our resource classes under
// exactOptionalPropertyTypes even though they are structurally valid,
// so the argument is asserted here once for every test.
export const findGtmProvider = <R extends ResourceLike>(
  resource: ResourceClass<R>,
): Effect.Effect<GtmProviderService<R>> =>
  Effect.map(
    Provider.findProvider(resource as ResourceClassLike<R>),
    (service) => service as GtmProviderService<R>,
  );

export type { FakeState };
