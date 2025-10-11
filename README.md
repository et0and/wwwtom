# wwwtom

A website of my very own, and my first foray into [SolidStart](https://start.solidjs.com/).

This is still very much a work in progress and has some rough edges.

## Developing

```bash
- `bnu run dev` - Start development server
- `bun run build` - Production build
- `bun run lint` - Run oxlint
- `bun run format` - Check formatting with Prettier
- `bun run write` - Format files with Prettier
```

## Deployment

This site is pretty cheap and bare bones. It uses Cloudflare Workers and Wrangler to build and deploy. All static media assets like images are hosted on a separate CDN to keep things lightweight and fast.

Previously this site used SST and AWS ECS with Fargate for deployment. While SST was lovely to use, the billing with AWS was a bloody nightmare so I abandoned it (even with spot instances it could quite easily get out of control).

## License

This is free software under the GPL. However, I kindly ask that you do not repost my work/images without permission or present this as your own.
