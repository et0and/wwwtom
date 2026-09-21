import { PageLayout } from "@tom/ui/PageLayout";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { createMemo, createSignal, Loading, Errored, Show, isPending, latest } from "solid-js";
import { useParams } from "@solidjs/router";
import { Effect, Option, Schema } from "effect";
import { formatPrice } from "@tom/checkout";
import { HttpError } from "@tom/types/errors";
import { Loader } from "@tom/ui/loader";
import { Button } from "@tom/ui/button";
import { Input } from "@tom/ui/input";
import { Banner } from "@tom/ui/banner";
import { Text } from "@tom/ui/text";
import { Label } from "@tom/ui/label";
import { getAdapterBaseUrl } from "~/libs/adapter";
import { runClient } from "@tom/utils/services/http";
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

  const NonEmptySchema = Schema.NonEmptyString;
  const EmailSchema = Schema.NonEmptyString.pipe(
    Schema.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
  );

  const validateEmail = (): boolean => {
    const value = email();
    if (Option.isNone(Schema.decodeOption(NonEmptySchema)(value))) {
      setEmailError("Email is required");
      return false;
    }
    if (Option.isNone(Schema.decodeOption(EmailSchema)(value))) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handlePurchase = (): void => {
    if (!validateEmail()) {
      return;
    }

    setIsRedirecting(true);
    setFormError("");
    setEmailError("");

    const program = Effect.tryPromise({
      try: () =>
        createCustomer({
          email: email(),
          ...(name() && { name: name() }),
          externalId: crypto.randomUUID(),
        }),
      catch: (error) =>
        error instanceof HttpError
          ? error
          : new HttpError({ message: "Failed to create customer", status: 500, cause: error }),
    }).pipe(
      Effect.tap((customer) =>
        Effect.sync(() => {
          const checkoutUrl = `${getAdapterBaseUrl()}/polar/checkout?products=${encodeURIComponent(params.productId ?? "")}&customerId=${encodeURIComponent(customer.id)}`;
          window.location.href = checkoutUrl;
        }),
      ),
      Effect.catch((error) =>
        Effect.sync(() => {
          setFormError(error.message);
          setIsRedirecting(false);
        }),
      ),
    );
    void runClient(program);
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
                        <Text variant="heading" as="h2">
                          {p().name}
                        </Text>
                        <Text>{p().description}</Text>
                        <Text size="lg" bold class="text-2xl">
                          {formatPrice(p())}
                        </Text>
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
                  Full Name <Text as="span">(optional)</Text>
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

          <Text variant="secondary" size="sm" class="text-center">
            Powered by{" "}
            <img src="/logotype_black.svg" alt="Polar" class="inline-block h-5 mx-1 -mt-0.5" />
          </Text>
        </div>
      </PageLayout>
    </>
  );
}
