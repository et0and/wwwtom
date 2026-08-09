/**
 * Disallow re-export statements (`export * from`, `export { x } from`,
 * `export * as ns from`, `export type { x } from`) mixed into files that
 * also contain other code.
 *
 * Scattered re-exports hide where a value actually lives: readers have to
 * follow every `from` clause back to the source module. Import directly
 * from the source module instead. (Pure barrel files are already banned by
 * `tom/no-barrel-file`.)
 */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow re-export statements mixed into files with other code",
    },
    messages: {
      reExport:
        "Unexpected re-export: import directly from the source module so imports stay easy to follow.",
    },
  },
  create(context) {
    return {
      Program(node) {
        const body = node.body;

        const isReExport = (statement) =>
          statement.type === "ExportAllDeclaration" ||
          (statement.type === "ExportNamedDeclaration" && statement.source != null);

        const hasOtherCode = body.some((statement) => !isReExport(statement));

        if (!hasOtherCode) {
          return;
        }

        for (const statement of body) {
          if (isReExport(statement)) {
            context.report({ node: statement, messageId: "reExport" });
          }
        }
      },
    };
  },
};

export default rule;
