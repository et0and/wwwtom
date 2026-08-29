import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import type { Address } from "@tom/types/address";
import { HttpError } from "@tom/types/errors";
import { Spinner } from "@tom/ui/Spinner";
import { callAdapter, unwrapAdapter } from "~/libs/adapter";

const fetchAddresses = async (query: string): Promise<readonly Address[]> => {
  const result = await callAdapter().address.search.get({
    query: { q: query, limit: "20" },
  });
  return unwrapAdapter(result);
};

export function AddressSearch() {
  const [query, setQuery] = createSignal("");
  const [debounced, setDebounced] = createSignal("");

  createEffect(() => {
    const value = query().trim();
    if (value.length < 3) {
      setDebounced("");
      return;
    }
    const id = setTimeout(() => setDebounced(value), 250);
    onCleanup(() => clearTimeout(id));
  });

  const isActive = createMemo(() => debounced().length >= 3);

  const [results] = createResource(debounced, (search) => {
    if (!search) return Promise.resolve([] satisfies readonly Address[]);
    return fetchAddresses(search);
  });

  return (
    <div class="address-search">
      <label class="block mb-2 font-medium" for="address-search-input">
        Search NZ addresses
      </label>
      <div class="relative w-full mb-2">
        <input
          id="address-search-input"
          type="search"
          placeholder="Try lambton quay..."
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          class="input w-full pr-10"
          autocomplete="off"
        />
        <Show when={results.loading}>
          <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Spinner />
          </div>
        </Show>
      </div>
      <Show when={query().trim().length > 0 && query().trim().length < 3}>
        <p class="text-sm text-muted mb-2">Enter at least 3 characters</p>
      </Show>
      <Show when={isActive()}>
        <div class="text-sm text-muted mb-2">
          <Show
            when={results.loading}
            fallback={`Showing ${results()?.length ?? 0} results for "${debounced()}"`}
          >
            Searching for "{debounced()}"...
          </Show>
        </div>
      </Show>
      <Show when={results.error}>
        {(error) => {
          const err = error() as unknown;
          const message =
            err instanceof HttpError
              ? `${err.message} (${err.status})`
              : err instanceof Error
                ? err.message
                : String(err);
          return <p class="text-sm text-red-600">Search failed: {message}</p>;
        }}
      </Show>
      <Show when={results()}>
        {(data) => (
          <Show when={data().length > 0} fallback={<p class="text-sm text-muted">No results</p>}>
            <ul class="space-y-2 list-none pl-0">
              <For each={data()}>
                {(item) => (
                  <li class="p-3 border rounded list-none">
                    <div class="font-medium">{item.fullAddress}</div>
                    <div class="text-sm text-muted">
                      {item.suburb}, {item.townCity}
                      <Show when={item.postcode}>{(postcode) => <span> · {postcode()}</span>}</Show>
                    </div>
                    <div class="text-xs text-subtle">
                      {item.longitude.toFixed(4)}, {item.latitude.toFixed(4)}
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        )}
      </Show>
    </div>
  );
}
