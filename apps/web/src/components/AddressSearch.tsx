import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";

type Address = {
  addressId: number;
  fullAddress: string;
  fullAddressNumber: string;
  fullAddressRoad: string | null;
  suburb: string;
  townCity: string;
  territorialAuthority: string;
  region: string | null;
  postcode: string | null;
  longitude: number;
  latitude: number;
};

const getApiBaseUrl = (): string => {
  const buildUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (buildUrl) return buildUrl;
  return import.meta.env.PROD ? "https://api.tom.so" : "http://localhost:8787";
};

const fetchAddresses = async (query: string): Promise<readonly Address[]> => {
  const url = new URL("/v1/search", getApiBaseUrl());
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "20");
  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Search failed: ${response.status}`);
  }
  return (await response.json()) as readonly Address[];
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
    if (!search) return Promise.resolve([] as readonly Address[]);
    return fetchAddresses(search);
  });

  return (
    <div class="address-search">
      <label class="block mb-2 font-medium" for="address-search-input">
        Search NZ addresses
      </label>
      <input
        id="address-search-input"
        type="search"
        placeholder="Try lambton quay..."
        value={query()}
        onInput={(event) => setQuery(event.currentTarget.value)}
        class="input w-full mb-2"
        autocomplete="off"
      />
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
        <p class="text-sm text-red-600">Search failed: {(results.error as Error).message}</p>
      </Show>
      <Show when={results()}>
        {(data) => (
          <Show when={data().length > 0} fallback={<p class="text-sm text-muted">No results</p>}>
            <ul class="space-y-2">
              <For each={data()}>
                {(item) => (
                  <li class="p-3 border rounded">
                    <div class="font-medium">{item.fullAddress}</div>
                    <div class="text-sm text-muted">
                      {item.suburb}, {item.townCity} {item.postcode ?? ""}
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
