# wwwtom

![Screenshot my website](wwwtom.png)

A monorepo of my very own.

This is still very much a work in progress and has some rough edges. I'm still fairly new to [Solid](https://solidjs.com).

I'm using this monorepo as a means of exploring different technologies and patterns, mostly for my own enjoyment.

## Developing

```bash
pnpm run dev # Start development server
pnpm run build # Production build
pnpm run lint # Run oxlint
pnpm run format # Check formatting with oxfmt
pnpm run write # Format files with oxfmt
```

External packages and dependencies have been deliberately kept small in order to keep the project lean.

Content is fetched from a headless [Payload CMS](https://payloadcms.com/) instance for the posts and works routes/slugs. All of the types and config is Payload specific, but could be swapped to a CMS of your choice.

## Deployment

The main site is pretty cheap and bare bones. It uses [Cloudflare Workers](https://workers.cloudflare.com) and [Alchemy](https://alchemy.run) to build and deploy. All static media assets like images are hosted on a separate CDN to keep things lightweight and fast.

It will be fairly obvious looking through this project that I use a lot of Cloudflare specific services and products like the Worker runtime, Wrangler and KV. This means it probably isn't as "portable" as it could be, but with how Alchemy is used it shouldn't be that difficult to swap out to a different provider like AWS.

## Testing

Unit tests run under Vitest in each workspace (`pnpm test` via Turbo).

End to end tests run under Playwright in `apps/e2e`, in two suites:

- **Fixture suite** (`tests/`): every page against a fully local stack. A fixture simulator (`apps/simulator`) stands in for the real upstreams (Payload CMS, Are.na, Polar, D1, internal API) via an `x-use-simulator` header, so the suite is deterministic. It runs on every PR against `dev` and nightly.
- **Staging suite** (`tests-staging/`): content-agnostic smoke checks against the deployed `staging` stage (`staging-web.tom.so`) with real upstreams. It runs nightly. Every push to `dev` redeploys staging, so the nightly validates the latest staged stack.

```bash
pnpm --filter @tom/e2e test:e2e # Fixture suite (local stack)
pnpm --filter @tom/e2e test:e2e:staging # Staging suite (deployed stage)
```

See `apps/e2e/README.md` for the full setup, conventions, and known gaps.

## License

This is free software under the GPL. However, I kindly ask that you do not repost my work/images without permission or present this as your own.
