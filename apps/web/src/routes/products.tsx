import { PageLayout } from "@tom/ui/PageLayout";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { createResource, For, Suspense, ErrorBoundary, Show } from "solid-js";
import { Spinner } from "@tom/ui/Spinner";
import { formatPrice } from "@tom/checkout";
import { fetchProducts } from "~/server/adapter";

export default function Checkout() {
  const [products] = createResource(() => fetchProducts());

  return (
    <>
      <PageLayout
        title="Products"
        description="Amazing, beautiful products by Tom Hackshaw for sale."
      >
        <div class="space-y-6">
          <BlurInText text="Products" tag="h1" baseDelay={0.1} step={0.025} />
          <BlurInSection delay={0.3}>
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
          </BlurInSection>
        </div>
      </PageLayout>
    </>
  );
}
