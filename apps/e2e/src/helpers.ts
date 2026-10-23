import { expect, type Page } from "@playwright/test";

/**
 * Event plumbing that isn't a Playwright primitive. Retry is not in here:
 * Playwright already retries a failed test, an assertion retries through
 * `expect(...).toPass()`, and a transient value retries through
 * `expect.poll`. A wrapper that re-issues `page.goto` or `request.get` in a
 * loop hides the real failure and doubles the wait, and the lint rule
 * `anti-slop/no-hand-rolled-retry-loop` rejects it.
 */

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
