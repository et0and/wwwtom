import { render, screen } from "@solidjs/testing-library";
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

  it("renders children inside the main landmark", () => {
    render(() => (
      <PageLayout title="Title" description="Description">
        <h1>Test content</h1>
      </PageLayout>
    ));

    expect(screen.getByRole("main")).toHaveTextContent("Test content");
  });

  it("exposes the main landmark for the skip link", () => {
    render(() => (
      <PageLayout title="Title" description="Description">
        <h1>Test content</h1>
      </PageLayout>
    ));

    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });
});
