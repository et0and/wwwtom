/**
 * Minimal Durable Object storage surface the agent uses. Workers-types would
 * clash with the DOM lib this program runs under, so the object and the chat
 * persistence layer share this structural contract instead. Overloads mirror
 * the real binding: one key or many per call.
 */
export interface AgentChatStorage {
  readonly get: {
    (key: string): Promise<object | undefined>;
    (keys: ReadonlyArray<string>): Promise<Map<string, object>>;
  };
  // oxlint-disable-next-line anti-slop/no-object-parameters, anti-slop/no-unsafe-dictionary-type -- mirrors the real binding; the values are persistence-module encoded documents typed `object` by BackingPersistenceStore.set, opaque to this layer
  readonly put: (entries: Record<string, object>) => Promise<void>;
  readonly delete: (keys: ReadonlyArray<string>) => Promise<number>;
  readonly list: (options: { readonly prefix: string }) => Promise<Map<string, object>>;
}

export interface AgentChatState {
  readonly storage: AgentChatStorage;
}
