import { componentRegistry } from "./registry.generated";
import {
  ensureFonts,
  ensureTokenVariables,
  generateEntry,
  tokenColorTable,
  type GenerationContext,
} from "./plugin/generate";
import { variantCount } from "./plugin/plan";

type PluginMessage =
  | { readonly type: "ready" }
  | { readonly type: "generate"; readonly slugs: ReadonlyArray<string> }
  | { readonly type: "close" };

figma.showUI(__html__, { width: 340, height: 560, themeColors: true });

function postRegistry(): void {
  figma.ui.postMessage({
    type: "registry",
    components: componentRegistry.map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      variantCount: variantCount(entry),
    })),
  });
}

async function runGeneration(slugs: ReadonlyArray<string>): Promise<void> {
  await ensureFonts();
  const context: GenerationContext = {
    tokens: tokenColorTable(),
    variables: ensureTokenVariables(),
  };
  let position = 0;
  let count = 0;
  for (const slug of slugs) {
    const entry = componentRegistry.find((candidate) => candidate.slug === slug);
    if (entry === undefined) continue;
    const result = generateEntry(entry, context, position);
    position = result.bottom + 120;
    count += 1;
  }
  figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);
  figma.notify(`Generated ${count} component set${count === 1 ? "" : "s"}`);
  figma.ui.postMessage({ type: "done", count });
}

figma.ui.onmessage = (message: PluginMessage): void => {
  if (message.type === "ready") postRegistry();
  if (message.type === "close") figma.closePlugin();
  if (message.type === "generate") {
    runGeneration(message.slugs).catch((error: Error) => {
      figma.notify(`Generation failed: ${error.message}`, { error: true });
      figma.ui.postMessage({ type: "failed", message: error.message });
    });
  }
};

postRegistry();
