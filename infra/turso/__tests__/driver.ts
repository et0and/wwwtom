import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Provider from "alchemy/Provider";
import type { ResourceClass, ResourceClassLike, ResourceLike } from "alchemy/Resource";
import { Stack } from "alchemy/Stack";
import type { StackSpec } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { makeFakeState, makeFakeTursoHttpLayer, type FakeState } from "../fake.ts";

const testStack: Omit<StackSpec, "output"> = {
  name: "wwwtom-turso",
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
    makeFakeTursoHttpLayer(state),
    Layer.succeed(Stack, testStack),
    Layer.succeed(Stage, "test"),
  );

type TursoProviderService<R extends ResourceLike> = Omit<
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
export const findTursoProvider = <R extends ResourceLike>(
  resource: ResourceClass<R>,
): Effect.Effect<TursoProviderService<R>> =>
  Effect.map(
    Provider.findProvider(resource as ResourceClassLike<R>),
    (service) => service as TursoProviderService<R>,
  );

/** A group plus its location, which every database test needs. */
export const seedGroup = (state: FakeState, name = "default", location = "aws-eu-west-1"): void => {
  state.groups.set(name, {
    name,
    uuid: "group-uuid",
    primary: location,
    delete_protection: false,
    locations: [location],
  });
};

export type { FakeState };
