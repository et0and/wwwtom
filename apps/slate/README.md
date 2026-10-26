# Slate marketing site

The public site for Slate, built with Astro and deployed with Alchemy.

```sh
pnpm --filter @tom/slate dev
pnpm --filter @tom/slate build
pnpm --filter @tom/slate typecheck
pnpm --filter @tom/slate lint
```

The site is static. Alchemy builds it with `Cloudflare.Website.Astro`; see
`infra/apps/slate.run.ts`. The production host is `slate.tom.so`; previews use
`pr-<number>-slate.tom.so`.
