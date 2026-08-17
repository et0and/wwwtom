import { expect, type Page } from "@playwright/test";

/**
 * Event plumbing that isn't a Playwright primitive — this file deliberately
 * contains no goto/expect wrappers; specs use page.goto, expect and locators
 * directly.
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
