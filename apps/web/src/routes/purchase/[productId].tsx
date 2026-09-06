import { PageLayout } from "@tom/ui/PageLayout";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { createMemo, createSignal, Loading, Errored, Show, isPending, latest } from "solid-js";
import { useParams } from "@solidjs/router";
import { formatPrice } from "@tom/checkout";
import { Loader } from "@tom/ui/tomui/loader";
import { Button } from "@tom/ui/tomui/button";
import { Input } from "@tom/ui/tomui/input";
import { Banner } from "@tom/ui/tomui/banner";
import { Label } from "@tom/ui/tomui/label";
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

      const checkoutUrl = `${getAdapterBaseUrl()}/polar/checkout?products=${encodeURIComponent(params.productId ?? "")}&customerId=${encodeURIComponent(customer.id)}`;
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
              <Errored fallback={<Banner variant="error" description="Failed to load product" />}>
                <Loading fallback={<Loader />}>
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
                <Label class="block text-sm mb-1">Email Address *</Label>
                <Input
                  type="email"
                  value={email()}
                  onInput={(e) => {
                    setEmail(e.currentTarget.value);
                    if (emailError()) setEmailError("");
                  }}
                  placeholder="john@email.com"
                  required
                  disabled={isRedirecting()}
                  error={emailError() || undefined}
                  class="w-full"
                />
              </div>

              <div>
                <Label class="block text-sm mb-1">
                  Full Name <span class="font-normal">(optional)</span>
                </Label>
                <Input
                  type="text"
                  value={name()}
                  onInput={(e) => {
                    setName(e.currentTarget.value);
                  }}
                  placeholder="John Product"
                  disabled={isRedirecting()}
                  class="w-full"
                />
              </div>

              <Show when={formError()}>
                <Banner variant="error" description={formError()} />
              </Show>

              <Button
                onClick={handlePurchase}
                variant="primary"
                loading={isRedirecting()}
                disabled={isRedirecting() || !email() || isPending(() => product())}
                class="w-full"
              >
                {isRedirecting() ? "Redirecting..." : "Proceed to payment"}
              </Button>
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
