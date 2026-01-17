import { PageLayout } from "~/layouts";
import { createResource, For, Suspense, ErrorBoundary, Show } from "solid-js";
import { Effect } from "effect";
import { Spinner } from "@tom/ui";
import { fetchProducts, formatPrice } from "@tom/checkout";

const isDev = import.meta.env.DEV;

export default function Checkout() {
  const [products] = createResource(() => Effect.runPromise(fetchProducts(isDev)));

  return (
    <>
      <PageLayout
        title="Products"
        description="Amazing, beautiful products by Tom Hackshaw for sale."
      >
        <div class="space-y-6">
          <h1>Products</h1>

          <ErrorBoundary fallback={<p class="text-red-600">Failed to load products</p>}>
            <Suspense fallback={<Spinner />}>
              <Show
                when={products()?.length}
                fallback={<p class="text-gray-500">No products available</p>}
              >
                <div class="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                  <For each={products()}>
                    {(product) => (
                      <div class="flex flex-col space-y-4">
                        <Show when={product.medias[0]?.public_url}>
                          {(url) => <img alt={product.name} src={url()} />}
                        </Show>
                        <h2>{product.name}</h2>
                        <p>{product.description}</p>
                        <div class="mt-auto">
                          <p class="text-2xl font-bold">{formatPrice(product)}</p>
                          <a href={`/purchase/${product.id}`} class="inline-block">
                            Purchase now
                          </a>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Suspense>
          </ErrorBoundary>
        </div>
      </PageLayout>
    </>
  );
}
