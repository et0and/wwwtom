export default Boolean(
  globalThis.window !== undefined &&
  globalThis.window.document &&
  globalThis.window.document.createElement,
);
