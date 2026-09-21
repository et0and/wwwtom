import type { UsesStep, With } from "../model";

/**
 * Third-party actions pinned to commit SHAs, with the release version as a
 * comment, once for every workflow. Renovate and Dependabot bump the pin here.
 */
const checkoutPin = "3d3c42e5aac5ba805825da76410c181273ba90b1"; // v7.0.1
const setupNodePin = "820762786026740c76f36085b0efc47a31fe5020"; // v7.0.0
const cachePin = "55cc8345863c7cc4c66a329aec7e433d2d1c52a9"; // v6.1.0
const pnpmActionPin = "0977fd99725f1db4007ccb2928dbb4e90d06cc86"; // v6.0.10

export const actionPins = {
  checkout: `actions/checkout@${checkoutPin}`,
  setupNode: `actions/setup-node@${setupNodePin}`,
  cache: `actions/cache@${cachePin}`,
  pnpmSetup: `pnpm/action-setup@${pnpmActionPin}`,
} as const;

const localSetupAction = "./.github/actions/setup";

export const checkout = (name = "Checkout", withValues?: With): UsesStep =>
  withValues === undefined
    ? { name, uses: actionPins.checkout }
    : { name, uses: actionPins.checkout, with: withValues };

/**
 * Call the shared setup composite. Local composite actions require the
 * workspace to exist first, so it must follow an explicit checkout.
 */
export const setupStep = (withValues?: With): UsesStep =>
  withValues === undefined
    ? { uses: localSetupAction }
    : { uses: localSetupAction, with: withValues };
