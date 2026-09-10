import { PageLayout } from "@tom/ui/PageLayout";
import { Text } from "@tom/ui/text";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { createMemo, For, Loading, Errored, Show } from "solid-js";
import { Loader } from "@tom/ui/loader";
import { formatPrice } from "@tom/checkout";
import { fetchProducts } from "~/server/adapter";

export default function Checkout() {
  const products = createMemo(() => fetchProducts());

  return (
    <>
      <PageLayout
        title="Products"
        description="Amazing, beautiful products by Tom Hackshaw for sale."
      >
        <div class="space-y-6">
          <BlurInText text="Products" tag="h1" baseDelay={0.1} step={0.025} />
          <BlurInSection delay={0.3}>
            <Errored fallback={<Text variant="error">Failed to load products</Text>}>
              <Loading fallback={<Loader />}>
                <Show
                  when={products()?.length}
                  fallback={<Text variant="secondary">No products available</Text>}
                >
                  <div class="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                    <For each={products()}>
                      {(product) => (
                        <div class="flex flex-col space-y-4">
                          <Show when={product.medias[0]?.public_url}>
                            {(url) => <img alt={product.name} src={url()} />}
                          </Show>
                          <Text variant="heading" as="h2">
                            {product.name}
                          </Text>
                          <Text>{product.description}</Text>
                          <div class="mt-auto">
                            <Text size="lg" bold class="text-2xl">
                              {formatPrice(product)}
                            </Text>
                            <a href={`/purchase/${product.id}`} class="inline-block">
                              Purchase now
                            </a>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </Loading>
            </Errored>
          </BlurInSection>
        </div>
      </PageLayout>
    </>
  );
}
