import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { PageLayout } from "@tom/ui/PageLayout";

describe("PageLayout", () => {
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
