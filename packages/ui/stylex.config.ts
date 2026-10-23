/**
 * Shared StyleX compiler options.
 *
 * Every Vite app passes this to `stylex.vite()`. The plugin must come BEFORE
 * `solid()` so its Babel transform sees `.stylex.ts` token files, which
 * `vite-plugin-solid` skips because they contain no JSX.
 *
 * Use `stylex.attrs()`, not `stylex.props()`: Solid reads `class`, React reads
 * `className`. `attrs` also returns a serialized `style` string, which is what
 * Solid's SSR output expects.
 */
export const stylexOptions = {
  // Generated rules land in @layer priority1..N. App CSS stays unlayered so it
  // keeps winning over generated utilities.
  useCSSLayers: true,
  dev: false,
  runtimeInjection: false,
  // StyleX style objects are referenced only via compiled class strings; without
  // this, bundlers drop the now-unused named imports and styles vanish.
  treeshakeCompensation: true,
  // Required for defineVars/createTheme, which resolve tokens across files.
  unstable_moduleResolution: { type: "commonJS" },
} as const;
