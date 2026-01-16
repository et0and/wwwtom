# Pulumi

Some infrastructure as code defined using Pulumi, for everything on Cloudflare.

## Setup

1. Install dependencies:

   ```bash
   cd infra
   bun install
   ```

2. Configure Cloudflare credentials:

   ```bash
   export CLOUDFLARE_API_TOKEN="your-api-token"
   ```

3. Initialize stack and configure:
   ```bash
   pulumi stack init
   pulumi config set cloudflare:accountId "your-account-id"
   pulumi config set app:zoneId "your-zone-id"
   pulumi config set app:domain "tom.so"
   ```

## Commands

```bash
# Preview changes (dry run)
bun run preview:infra

# Deploy infrastructure
bun run deploy:infra

# Destroy infrastructure
cd infra && bun run destroy
```

## Resources

### apps/web

- **WorkersKvNamespace**: Rate limiting KV namespace
- **WorkersScript**: wwwtom worker
- **WorkersRoute**: Route pattern (tom.so/\*)

### apps/api

- **WorkersScript**: apitom worker
- **WorkersRoute**: Route pattern (api.tom.so/\*)

## Notes

- Worker script content is read from `apps/web/.output/server/index.mjs` and `apps/api/src/index.ts`
- Ensure you've run `bun build` for apps/web before deploying
- NODE_ENV is set to "production" for all workers
