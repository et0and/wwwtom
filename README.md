# wwwtom

![Screenshot my website](wwwtom.png)

A website of my very own, and my first foray into [Solid Start](https://start.solidjs.com/) and Turborepo.

This is still very much a work in progress and has some rough edges. I'm still fairly new to [Solid](https://solidjs.com) and am a recovering React user lol.

## Developing

```bash
bun run dev # Start development server
bun run build # Production build
bun run lint # Run oxlint
bun run format # Check formatting with oxfmt
bun run write # Format files with oxfmt
```

External packages and dependencies have been deliberately kept small in order to keep the project lean.

Content is fetched from a headless [Payload CMS](https://payloadcms.com/) instance for the posts and works routes/slugs. All of the types and config is Payload specific, but could be swapped to a CMS of your choice.

## Deployment

This site is pretty cheap and bare bones. It uses Cloudflare Workers and Wrangler to build and deploy. All static media assets like images are hosted on a separate CDN to keep things lightweight and fast.

It will be fairly obvious looking through this project that I use a lot of Cloudflare specific services and products like the Worker runtime, Wrangler and KV. This means it probably isn't as "portable" as it could be, but it wouldn't be too difficult for someone to fork and replace Worker specific config for Node, Deno etc.

Previously this site used [SST](https://sst,dev) and AWS ECS with Fargate for deployment. While SST was lovely to use, the billing with AWS was a bloody nightmare so I quickly abandoned it (even with spot instances it could quite easily get out of control).

## Testing

I use Vitest for snapshot and integration tests.

## Credits

I make extensive use of [arena-ts](https://github.com/e-e-e/arena-ts) by [Benjamin Forster]. I wanted to use [Effect](https://effect.website) with a lot of the client callers so have just got the entirely library in this repo, but all credit to him (I have added attribution as comments in the relevant files). It's an awesome library and provides a great way of working with the [are.na API](https://dev.are.na) in Typescript projects.

As mentioned above, I also make use of Effect for handling errors clearly and logging. It is a lot to learn so I am just adding it incrementally, but am hoping to make greater use of the library in the future for handling things like retries, observability and so on.

## License

This is free software under the GPL. However, I kindly ask that you do not repost my work/images without permission or present this as your own.
