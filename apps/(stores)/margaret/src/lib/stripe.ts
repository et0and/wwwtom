import Stripe from "stripe";

// Lazy singleton — do not instantiate at module load time.
// The secret key may not be available during Next.js build.
let _stripe: Stripe | null = null;

export const getStripe = (secretKey: string): Stripe => {
  if (_stripe) return _stripe;
  _stripe = new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: "2025-02-24.acacia",
  });
  return _stripe;
};
