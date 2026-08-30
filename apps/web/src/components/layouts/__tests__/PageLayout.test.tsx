import { render } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { PageLayout } from "@tom/ui/PageLayout";

describe("PageLayout", () => {
  it("matches the snapshot", () => {
    const { container } = render(() => (
      <PageLayout
        title="Tom and his page layout"
        description="Microservices were a massive mistake"
      >
        <h1>Test content</h1>
      </PageLayout>
    ));
    const snapshot = container.cloneNode(true) as HTMLElement;
    const whitespaceNodes = [] as Text[];
    const walker = document.createTreeWalker(snapshot, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (!node.textContent?.trim()) whitespaceNodes.push(node as Text);
      node = walker.nextNode();
    }
    whitespaceNodes.forEach((textNode) => textNode.remove());
    expect(snapshot).toMatchSnapshot();
  });
});
