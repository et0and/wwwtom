# wwwtom

A website of my very own, and my first foray into [SolidStart](https://start.solidjs.com/).

This is still very much a work in progress and has some rough edges.

## Developing

```bash
- `npm ci` - Clean install dependencies
- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run lint` - Run oxlint
- `npm run format` - Check formatting with Prettier
- `npm run write` - Format files with Prettier
```

## Deployment

This site is pretty cheap and bare bones. It uses [SST](https://sst.dev) to define infrastructure as code, deploying to AWS using ECS with Fargate. DNS is using Cloudflare (also defined in my SST config), which gives me a CDN for free.

I have a `dev`, `staging` and `production` branch with associated GitHub Actions to automatically build and deploy on merges/commits. Releases are currently tied to the `dev` branch, but in the future I will probably transfer this to `main` once things are a bit more stable.

You could quite easily deploy this using something like Vercel or even in a Lambda if you're still using AWS.

## License

This is free software under the GPL. However, I kindly ask that you do not repost my work/images without permission or present this as your own.
