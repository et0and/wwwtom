import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

/**
 * Playwright call names that already retry or auto-wait on their own: the
 * runner retries a failed test through `retries`, an assertion retries through
 * `expect(...).toPass()` and `expect.poll`, and these methods wait for
 * actionability themselves.
 */
const PLAYWRIGHT_METHODS = new Set([
  // Navigation
  "goto",
  "reload",
  "goBack",
  "goForward",
  // Waiting
  "waitForURL",
  "waitForLoadState",
  "waitForSelector",
  "waitForResponse",
  "waitForRequest",
  "waitForEvent",
  "waitForFunction",
  "waitForTimeout",
  // Actions
  "click",
  "dblclick",
  "tripleclick",
  "fill",
  "clear",
  "type",
  "press",
  "check",
  "uncheck",
  "setChecked",
  "hover",
  "selectOption",
  "setInputFiles",
  "tap",
  "focus",
  "blur",
  "dragTo",
  "dispatchEvent",
  // APIRequestContext
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "dispose",
]);

/** `fetch` on a global is the platform's, not Playwright's, so it is never a match. */
const GLOBAL_OBJECTS = new Set(["globalThis", "global", "window", "self"]);

const FUNCTION_TYPES = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
]);

/** The awaited Playwright method name, or null when the value awaits anything else. */
function awaitedPlaywrightMethod(expression: ESTree.Expression): string | null {
  let current = expression;
  while (current.type === "ParenthesizedExpression") current = current.expression;
  if (current.type !== "CallExpression") return null;

  const callee = current.callee;
  if (callee.type !== "MemberExpression" || callee.computed) return null;
  if (callee.object.type === "Identifier" && GLOBAL_OBJECTS.has(callee.object.name)) return null;
  return callee.property.name;
}

/**
 * The retry-shaped loop the node sits in, or null. `for...of` and `for...in`
 * are their own node types and never match, so iterating a list stays legal;
 * a counted `for`, `while` and `do...while` are the shapes a hand-rolled
 * retry takes.
 */
function enclosingRetryLoop(node: ESTree.Node): ESTree.Node | null {
  let current = node.parent;
  while (current.type !== "Program") {
    if (FUNCTION_TYPES.has(current.type)) return null;
    if (current.type === "ForStatement" && current.test !== null) return current;
    if (current.type === "WhileStatement" || current.type === "DoWhileStatement") return current;
    current = current.parent;
  }
  return null;
}

/** Disallow a retry-shaped loop that awaits a Playwright call. */
export const noHandRolledRetryLoopRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow retry-shaped loops that await a Playwright call; use the runner's own retries and `expect(...).toPass()`.",
    },
    messages: {
      handRolledRetryLoop:
        "This loop re-issues a Playwright call until it passes. Playwright already retries through the runner's `retries`, `expect(...).toPass()` and `expect.poll`; a hand-rolled loop hides real failures and doubles the wait. Call the method directly, or assert with `expect.poll` when the value is genuinely transient.",
    },
  },
  create(context) {
    return {
      AwaitExpression(node) {
        const method = awaitedPlaywrightMethod(node.argument);
        if (method === null || !PLAYWRIGHT_METHODS.has(method)) return;
        if (enclosingRetryLoop(node) !== null) {
          context.report({ node, messageId: "handRolledRetryLoop" });
        }
      },
    };
  },
});