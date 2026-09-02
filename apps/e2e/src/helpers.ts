import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
  type Response,
} from "@playwright/test";

/**
 * Event plumbing that isn't a Playwright primitive — this file deliberately
 * contains no goto/expect wrappers; specs use page.goto, expect and locators
 * directly. The two backoff helpers below are the exception: they exist only
 * because the staging suite runs from GitHub-hosted runner IPs, which
 * Cloudflare bot protection intermittently fast-blocks (see spec header).
 */

/**
 * Exponential backoff policy, mirroring Effect's Schedule.exponential: the
 * first retry waits baseDelayMs and every subsequent retry doubles it.
 */
export interface BackoffOptions {
  /** Total attempts including the first. Defaults to 4. */
  attempts?: number;
  /** Delay before the first retry, in ms. Doubles per retry. Defaults to 2s. */
  baseDelayMs?: number;
}

/**
 * Statuses Cloudflare's managed protections use when it fast-blocks or
 * rate-limits a runner IP. Any other status is a real app answer and is
 * returned on the first attempt so regressions surface immediately.
 */
const TRANSIENT_STATUSES = new Set([403, 429, 502, 503, 504]);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** True while the page is showing the Cloudflare Managed Challenge interstitial. */
const isCloudflareChallenge = async (page: Page): Promise<boolean> =>
  page.url().includes("__cf_chl") ||
  (await page.getByText("Performing security verification").isVisible());

/**
 * GET with exponential backoff. Retries only on transient Cloudflare
 * statuses; the first GET that answers with anything else is returned as-is.
 */
export const fetchWithBackoff = async (
  request: APIRequestContext,
  url: string,
  options: BackoffOptions = {},
): Promise<APIResponse> => {
  const { attempts = 4, baseDelayMs = 2_000 } = options;
  let response: APIResponse | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    response = await request.get(url);
    if (response.ok() || !TRANSIENT_STATUSES.has(response.status())) return response;
    if (attempt < attempts - 1) await sleep(baseDelayMs * 2 ** attempt);
  }
  return response as APIResponse;
};

/**
 * Navigate with exponential backoff. If Cloudflare answers the browser with
 * its Managed Challenge interstitial, wait and try again — the verification
 * state on the runner IP often clears within one or two backoff windows.
 * Returns the final navigation's response, challenge page or not.
 */
export const gotoWithBackoff = async (
  page: Page,
  url: string,
  options: BackoffOptions = {},
): Promise<Response | null> => {
  const { attempts = 4, baseDelayMs = 2_000 } = options;
  let response: Response | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    response = await page.goto(url);
    if (!(await isCloudflareChallenge(page))) return response;
    if (attempt < attempts - 1) await sleep(baseDelayMs * 2 ** attempt);
  }
  return response;
};

/** Return an assertion fn that fails if the page committed page/console errors. */
export const expectNoPageErrors = (page: Page) => {
  const errors: string[] = [];
  const onError = (error: Error) => errors.push(error.message);
  const onConsole = (message: import("@playwright/test").ConsoleMessage) => {
    if (message.type() === "error") errors.push(message.text());
  };
  page.on("pageerror", onError);
  page.on("console", onConsole);
  return () => {
    page.off("pageerror", onError);
    page.off("console", onConsole);
    expect(errors).toEqual([]);
  };
};
