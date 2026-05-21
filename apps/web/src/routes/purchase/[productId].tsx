import { PageLayout } from "~/layouts";
import { BlurInSection, BlurInText } from "~/components";
import { createResource, createSignal, Suspense, ErrorBoundary, Show, createMemo } from "solid-js";
import { Effect } from "effect";
import { useParams } from "@solidjs/router";
import { fetchProduct, formatPrice, createCustomer, getCheckoutUrl } from "@tom/checkout";
import { Spinner } from "@tom/ui";

const isDev = import.meta.env.DEV;

export default function Purchase() {
  const params = useParams();
  const [product] = createResource(
    () => params.productId,
    (id) => Effect.runPromise(fetchProduct(id, isDev)),
  );

  const [isRedirecting, setIsRedirecting] = createSignal(false);
  const [email, setEmail] = createSignal("");
  const [name, setName] = createSignal("");
  const [formError, setFormError] = createSignal("");
  const [emailError, setEmailError] = createSignal("");

  const pageTitle = createMemo(() => {
    const p = product();
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

    const result = await Effect.runPromiseExit(
      createCustomer(
        {
          email: email(),
          name: name() || undefined,
          externalId: crypto.randomUUID(),
        },
        isDev,
      ),
    );

    if (result._tag === "Failure") {
      const cause = result.cause;
      const errorData = cause._tag === "Fail" ? cause.error : null;
      const apiError = errorData ? JSON.parse(errorData.message) : null;
      const validationError = apiError?.detail?.find((d: { loc: string[]; msg: string }) =>
        d.loc?.includes("email"),
      );

      if (validationError) {
        setEmailError(validationError.msg);
      } else {
        setFormError("Failed to create customer");
      }
      setIsRedirecting(false);
      return;
    }

    const checkoutUrl = getCheckoutUrl(params.productId ?? "", result.value.id, isDev);
    window.location.href = checkoutUrl;
  };

  return (
    <>
      <PageLayout title={pageTitle} description="Complete your purchase">
        <div class="max-w-md mx-auto space-y-6">
          <BlurInText text="Complete your purchase" class="h1" baseDelay={0.1} step={0.025} />
          <BlurInSection delay={0.3}>
            <div class="space-y-4">
              <ErrorBoundary
              fallback={<p class="text-center text-red-600">Failed to load product</p>}
            >
              <Suspense fallback={<Spinner />}>
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
              </Suspense>
            </ErrorBoundary>
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
                  onInput={(e) => setName(e.currentTarget.value)}
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
                disabled={isRedirecting() || !email() || product.loading}
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
