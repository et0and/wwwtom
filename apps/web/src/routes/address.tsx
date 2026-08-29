import { createEffect, createMemo, createSignal, For, onCleanup, Show, Suspense } from "solid-js";
import { useQuery } from "@tanstack/solid-query";
import { PageLayout } from "@tom/ui/PageLayout";
import { Spinner } from "@tom/ui/Spinner";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { callAdapter, unwrapAdapter } from "~/libs/adapter";
import type { Address, Meta } from "@tom/types/address";
import { HttpError } from "@tom/types/errors";

const fetchAddressSearch = async (query: string): Promise<readonly Address[]> => {
  const result = await callAdapter().address.search.get({ query: { q: query, limit: "20" } });
  return unwrapAdapter(result);
};

const fetchMeta = async (): Promise<Meta> => {
  const result = await callAdapter().address.meta.get();
  return unwrapAdapter(result);
};

export default function AddressPage() {
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

  const searchQuery = useQuery(() => ({
    queryKey: ["address-search", debounced()],
    queryFn: () => fetchAddressSearch(debounced()),
    enabled: isActive(),
  }));

  const metaQuery = useQuery(() => ({
    queryKey: ["address-meta"],
    queryFn: fetchMeta,
  }));

  return (
    <PageLayout
      title="Address Search — Demo"
      description="Demo: NZ addresses via Neon tsvector — research branch with partial seed via adapter treaty"
    >
      <BlurInText text="Address Search" tag="h1" baseDelay={0.1} step={0.025} />
      <BlurInSection delay={0.2}>
        <div class="mb-4 p-3 border border-dashed rounded bg-gray-50 dark:bg-white/5 text-sm">
          Demo — research branch with partial Neon seed. `tsvector` on read replica, 250ms debounce,
          3-char guard. Full NZ set is 2.1M.
        </div>
        <Suspense fallback={<Spinner />}>
          <Show when={metaQuery.data}>
            {(meta) => (
              <p class="mb-6 text-sm text-subtle">
                {meta().totalAddresses.toLocaleString()} addresses ·{" "}
                {meta().version === "unknown" ? "demo" : `v${meta().version}`} · updated{" "}
                {new Date(meta().lastUpdated).toLocaleDateString("en-NZ")}
              </p>
            )}
          </Show>
        </Suspense>
      </BlurInSection>

      <BlurInSection delay={0.3}>
        <label class="block mb-2 font-medium" for="address-search-input">
          Search NZ addresses
        </label>
        <div class="relative w-full mb-2">
          <input
            id="address-search-input"
            type="search"
            placeholder="Try lambton quay, queen st, mt eden..."
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            class="input w-full pr-10"
            autocomplete="off"
          />
          <Show when={searchQuery.isFetching}>
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
              when={searchQuery.isFetching}
              fallback={`Showing ${searchQuery.data?.length ?? 0} results for "${debounced()}"`}
            >
              Searching for "{debounced()}"...
            </Show>
          </div>
        </Show>
        <Show when={searchQuery.error}>
          {(error) => {
            const err = error();
            const message =
              err instanceof HttpError
                ? `${err.message} (${err.status})`
                : err instanceof Error
                  ? err.message
                  : String(err);
            return <p class="text-sm text-red-600">Search failed: {message}</p>;
          }}
        </Show>

        <Suspense fallback={<Spinner />}>
          <Show when={searchQuery.data}>
            {(data) => (
              <Show
                when={data().length > 0}
                fallback={<p class="text-sm text-muted">No results</p>}
              >
                <ul class="space-y-2 list-none pl-0">
                  <For each={data()}>
                    {(item) => (
                      <li class="p-3 border rounded list-none">
                        <div class="font-medium">{item.fullAddress}</div>
                        <div class="text-sm text-muted">
                          {item.suburb}, {item.townCity}
                          <Show when={item.postcode}>
                            {(postcode) => <span> · {postcode()}</span>}
                          </Show>
                        </div>
                        <div class="text-xs text-subtle">
                          {item.longitude.toFixed(4)}, {item.latitude.toFixed(4)} ·{" "}
                          {item.territorialAuthority}
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            )}
          </Show>
        </Suspense>
      </BlurInSection>
    </PageLayout>
  );
}
