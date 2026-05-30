import { createStringsDict } from "@tom/strings";

const phrases = {
  /** "Home" */
  "nav.home": "Home",
  /** "About us" */
  "nav.about": "About us",
  /** "Hello, {name}!" */
  "welcome.greeting": "Hello, {name}!",
} as const;

export const webDict = createStringsDict(phrases);
