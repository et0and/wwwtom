# @tom/ui Storybook

This package contains shared UI components with Storybook for component documentation and testing.

## Available Scripts

- `bun run storybook` - Start Storybook development server on port 6006
- `bun run build` - Build Storybook for production
- `bun run deploy` - Deploy Storybook to Cloudflare Workers

## Component Stories

All components have corresponding `.stories.tsx` files:

- **Nav** - Navigation component with mobile menu
- **Link** - Custom link component with loading spinner
- **Spinner** - Loading spinner with color variants
- **Footer** - Site footer component
- **SkipLink** - Accessibility skip-to-content link
- **PageLayout** - Page layout wrapper with metadata
- **Metadata** - SEO meta tags component
- **OgTemplates** - Open Graph image templates

## Deployment

The Storybook is configured to deploy to Cloudflare Workers using Workers Assets.

To deploy:

```bash
# From repo root
bun run deploy:ui

# Or from packages/@tom/ui
bun run build
bun run deploy
```

## Configuration

- `.storybook/main.ts` - Storybook configuration
- `.storybook/preview.ts` - Preview settings
- `wrangler.toml` - Cloudflare Workers deployment config
- `vite.config.ts` - Vite configuration with SolidJS plugin

## Tech Stack

- Storybook 7.x
- SolidJS 1.x
- Vite 5.x
- @storybook/html-vite renderer
- vite-plugin-solid for JSX transformation

## Notes

Components that use `@solidjs/router` or `@solidjs/meta` are wrapped with their respective providers in the story decorators.
