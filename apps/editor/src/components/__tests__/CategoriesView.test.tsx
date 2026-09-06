import { fireEvent, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoriesView } from "../CategoriesView";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const jsonResponse = <B,>(body: B, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const categories = [{ id: "cat-1", slug: "essays", title: "Essays" }];

describe("CategoriesView", () => {
  it("lists categories and adds a new one", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(categories))
      .mockResolvedValueOnce(jsonResponse({ id: "cat-2", slug: "notes", title: "Notes" }))
      .mockResolvedValueOnce(
        jsonResponse([...categories, { id: "cat-2", slug: "notes", title: "Notes" }]),
      );
    const { findByLabelText, findByRole, findByText } = render(() => (
      <CategoriesView onBack={() => undefined} />
    ));
    expect(await findByText("Essays · essays")).toBeInTheDocument();
    expect(await findByRole("button", { name: "← Back" })).toHaveClass("back-button");
    fireEvent.input(await findByLabelText("Slug"), { target: { value: "notes" } });
    fireEvent.input(await findByLabelText("Title"), { target: { value: "Notes" } });
    fireEvent.click(await findByRole("button", { name: "Add category" }));
    expect(await findByText("Notes · notes")).toBeInTheDocument();
    const [, addInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(addInit.method).toBe("POST");
  });

  it("shows validation errors without saving", async () => {
    fetchMock.mockResolvedValue(jsonResponse(categories));
    const { findByRole, findByText } = render(() => <CategoriesView onBack={() => undefined} />);
    await findByText("Essays · essays");
    fireEvent.click(await findByRole("button", { name: "Add category" }));
    expect(await findByText("Invalid category data")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deletes after confirm", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(categories))
      .mockResolvedValueOnce(jsonResponse({ id: "cat-1" }))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { findByRole } = render(() => <CategoriesView onBack={() => undefined} />);
    fireEvent.click(await findByRole("button", { name: "Delete category essays" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(deleteUrl).toBe("http://localhost:8788/content/categories/essays");
    expect(deleteInit.method).toBe("DELETE");
  });
});
