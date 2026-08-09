/**
 * Disallow barrel files: files whose only content is re-export statements
 * (`export * from`, `export { x } from`, `export * as ns from`).
 *
 * Barrels force bundlers and Node's ESM loader to walk the whole re-export
 * subtree on every import (startup/bundle cost) and are the classic source
 * of extensionless-import resolution failures under Node type stripping.
 * Prefer direct imports from the source module.
 */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow barrel files that only re-export other modules",
    },
    messages: {
      barrel:
        "Barrel file: this file only re-exports other modules. Import directly from the source module instead.",
    },
  },
  create(context) {
    return {
      Program(node) {
        const body = node.body;
        if (body.length === 0) {
          return;
        }

        const isBarrel = body.every(
          (statement) =>
            statement.type === "ExportAllDeclaration" ||
            (statement.type === "ExportNamedDeclaration" && statement.source != null),
        );

        if (isBarrel) {
          context.report({ node, messageId: "barrel" });
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: "tom",
  },
  rules: {
    "no-barrel-file": rule,
  },
};

export default plugin;
