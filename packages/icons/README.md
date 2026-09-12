# @tom/icons

Phosphor icons as type-safe Solid 2.0 components. Generated from
`@phosphor-icons/core`; generated files embed path data, so there is no
runtime dependency on the core package.

```tsx
import { GoogleIcon } from "@tom/icons/social/google";

<GoogleIcon size="md" color="white" />;
```

## Import shapes

- `@tom/icons/<Name>` — one icon, for example `@tom/icons/GoogleLogo`.
  Every icon exports `<Name>Icon` plus a short alias (`GoogleLogo`).
- `@tom/icons/social/<brand>` — friendly brand aliases, for example
  `GoogleIcon`. The `social/` folder is hand-curated; brand icons without
  an alias are still available under their canonical `*Logo` module.
- `@tom/icons/IconBase` — the base renderer. `@tom/icons/types` — tokens.

There is no package root (`.`) entry and no barrel file: bundlers resolve
one file per import, which keeps tree-shaking exact. The package is
`private` and ships source (`.tsx`) for the monorepo's Vite consumers.

## Props

`size` and `color` accept tokens only; anything else fails typecheck.

| Prop     | Tokens                                                | Default   |
| -------- | ----------------------------------------------------- | --------- |
| `size`   | `xs` 12, `sm` 16, `md` 20, `lg` 24, `xl` 32, `2xl` 48 | `md`      |
| `color`  | `current`, tomui text tokens, `white`, `black`        | `current` |
| `weight` | `thin`, `light`, `regular`, `bold`, `fill`, `duotone` | `regular` |

`mirrored` flips the icon for RTL layouts. `title` sets an accessible
name (omitted or blank stays decorative). `children` render below the
icon paths. Unknown tokens from plain-JS callers fall back to defaults.

## Naming notes

- `XIcon` is the close icon (`@tom/icons/X`). The X brand logo is
  `XLogoIcon`, re-exported from `@tom/icons/social/x`.
- Seven icons ship without a short alias because the alias would shadow a
  bare JS or browser global: `File`, `Function`, `Image`, `Infinity`,
  `Option`, `Scroll`, `Stop`. Use their `<Name>Icon` component.
- Phosphor catalog aliases (for example `Lemniscate` for `Infinity`) are
  not generated; canonical names only.

## Regenerate

Re-run after a `@phosphor-icons/core` version bump:

```sh
pnpm --filter @tom/icons generate
```

Generation resolves the core package through the module resolver (safe
under pnpm isolation), validates every weight SVG before writing, checks
that `social/` targets exist, and fails when a social export would
collide with a generated export name.
