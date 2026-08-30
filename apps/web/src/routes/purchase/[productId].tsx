import { PageLayout } from "@tom/ui/PageLayout";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { createMemo, createSignal, Loading, Errored, Show, isPending, latest } from "solid-js";
import { useParams } from "@solidjs/router";
import { formatPrice } from "@tom/checkout";
import { Spinner } from "@tom/ui/Spinner";
import { getAdapterBaseUrl } from "~/libs/adapter";
import { fetchProduct, createCustomer } from "~/server/adapter";

export default function Purchase() {
  const params = useParams();
  const product = createMemo(() => {
    const productId = params.productId;
    if (!productId) throw new Error("Missing product id");
    return fetchProduct(productId);
  });
  const [isRedirecting, setIsRedirecting] = createSignal(false);
  const [email, setEmail] = createSignal("");
  const [name, setName] = createSignal("");
  const [formError, setFormError] = createSignal("");
  const [emailError, setEmailError] = createSignal("");

  const pageTitle = createMemo(() => {
    const p = latest(() => product());
    return p ? `Purchase ${p.name}` : "Purchase";
  });

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateEmail = () => {
    const value = email();
    if (!value) {
      setEmailError("Email is required");
      return false;
    }
    if (!isValidEmail(value)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handlePurchase = async () => {
    if (!validateEmail()) {
      return;
    }

    setIsRedirecting(true);
    setFormError("");
    setEmailError("");

    try {
      const customer = await createCustomer({
        email: email(),
        ...(name() && { name: name() }),
        externalId: crypto.randomUUID(),
      });

      const checkoutUrl = `${getAdapterBaseUrl()}/polar/checkout?products=${params.productId ?? ""}&customerId=${customer.id}`;
      window.location.href = checkoutUrl;
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create customer");
      setIsRedirecting(false);
    }
  };

  return (
    <>
      <PageLayout title={pageTitle} description="Complete your purchase">
        <div class="max-w-md mx-auto space-y-6">
          <BlurInText text="Complete your purchase" tag="h1" baseDelay={0.1} step={0.025} />
          <BlurInSection delay={0.3}>
            <div class="space-y-4">
              <Errored fallback={<p class="text-center text-red-600">Failed to load product</p>}>
                <Loading fallback={<Spinner />}>
                  <Show when={product()}>
                    {(p) => (
                      <>
                        <Show when={p().medias[0]?.public_url}>
                          {(url) => <img alt={p().name} src={url()} />}
                        </Show>
                        <h2>{p().name}</h2>
                        <p>{p().description}</p>
                        <p class="text-2xl">{formatPrice(p())}</p>
                      </>
                    )}
                  </Show>
                </Loading>
              </Errored>
            </div>
          </BlurInSection>
          <BlurInSection delay={0.5}>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={email()}
                  onInput={(e) => {
                    setEmail(e.currentTarget.value);
                    if (emailError()) setEmailError("");
                  }}
                  placeholder="john@email.com"
                  required
                  disabled={isRedirecting()}
                  class="w-full px-3 py-2 border border-gray-300 disabled:bg-gray-100"
                />
                <Show when={emailError()}>
                  <p class="text-red-600 text-sm mt-1">{emailError()}</p>
                </Show>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Full Name (optional)
                </label>
                <input
                  type="text"
                  value={name()}
                  onInput={(e) => {
                    setName(e.currentTarget.value);
                  }}
                  placeholder="John Product"
                  disabled={isRedirecting()}
                  class="w-full px-3 py-2 border border-gray-300 disabled:bg-gray-100"
                />
              </div>

              <Show when={formError()}>
                <p class="text-red-600 text-sm">{formError()}</p>
              </Show>

              <button
                onClick={handlePurchase}
                disabled={isRedirecting() || !email() || isPending(() => product())}
                class="w-full bg-[#ad1174] text-white px-4 py-2 hover:bg-[#cc0081] cursor-pointer disabled:bg-gray-400"
              >
                {isRedirecting() ? "Redirecting..." : "Proceed to payment"}
              </button>
            </div>
          </BlurInSection>

          <p class="text-sm text-center">
            Powered by{" "}
            <img src="/logotype_black.svg" alt="Polar" class="inline-block h-5 mx-1 -mt-0.5" />
          </p>
        </div>
      </PageLayout>
    </>
  );
}
