# Agent Guidelines for wwwtom

## Build Commands

- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run lint` - Run oxlint
- `npm run format` - Check formatting with Prettier
- `npm run write` - Format files with Prettier
- No test framework configured

## Code Style

- **Framework**: SolidJS with TypeScript (JSX preserved)
- **Formatting**: Prettier with tabs (2-space width), 80 char width, semicolons, double quotes
- **Imports**: Use `~/` alias for src directory, group external imports first
- **Components**: Export default functions, use PascalCase filenames
- **Types**: Strict TypeScript, interfaces for objects, explicit return types for exported functions
- **Styling**: TailwindCSS with utility classes
- **File structure**: Components in `/src/components/`, routes in `/src/routes/`, types in `/src/types/`
- **Accessibility**: Include ARIA labels and semantic HTML

## Important Notes

- No Cursor/Copilot rules found
- Uses Vinxi as build tool
- Supports MDX files for content
- Path alias `~/` maps to `./src/`
