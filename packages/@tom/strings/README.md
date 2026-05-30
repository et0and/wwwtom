# @tom/strings

Typesafe string dictionary utility with interpolation and JSDoc hover support.

## Usage

Create a `strings.ts` file in your app:

```typescript
import { createStringsDict } from "@tom/strings";

const phrases = {
  "nav.home": "Home",
  "nav.about": "About us",
  "welcome.greeting": "Hello, {name}!",
} as const;

export const webDict = createStringsDict(phrases);
```

Consume in components:

```typescript
import { webDict } from "./strings";

<span>{webDict.t("nav.home")}</span>
<p>{webDict.t("welcome.greeting", { name: "Tom" })}</p>
```

## JSDoc hover support

Run `pnpm strings:generate` (or let Turbo run it automatically) to inject JSDoc
comments into every `strings.ts` file. After generation, hovering a key in a
`.t(...)` call in VSCode will show the actual string value.

## Adding strings to a new app

1. Create `strings.ts` in the app root (or any directory).
2. Define a `phrases` object with string values and `as const`.
3. Export a dict via `createStringsDict(phrases)`.
4. Import the dict wherever you need localised copy.
5. Run `pnpm strings:generate` to add hover annotations.

## Interpolation

Use `{placeholder}` syntax in phrase values. Pass a map as the second argument
to `.t()`. Missing placeholders are left unreplaced — no runtime error.
