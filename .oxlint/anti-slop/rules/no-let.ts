import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

/**
 * Ban `let` declarations. A mutable binding is a deliberate exception: write
 * the `const` transform, or disable this rule with a reason at the site.
 */
export const noLetRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow `let` declarations. Prefer `const` and immutable updates.",
    },
    messages: {
      avoid:
        "Do not use `let`. Prefer `const` with `map`/`reduce`, or disable this rule with a reason when mutable state is required.",
    },
  },
  create(context) {
    return {
      VariableDeclaration(node: ESTree.VariableDeclaration) {
        if (node.kind !== "let") return;
        context.report({ node, messageId: "avoid" });
      },
    };
  },
});
