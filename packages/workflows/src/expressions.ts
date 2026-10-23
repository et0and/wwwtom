import type { Expression } from "./model";

/**
 * Build a GitHub Actions expression from its body. The `${{ ... }}` wrapper is
 * applied here so definitions never hand-write it.
 */
export const ex = (body: string): Expression => `\${{ ${body} }}` as Expression;
