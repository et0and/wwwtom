import { render } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditorView } from "../EditorView";
import { fetchMock, jsonResponse, tiptapDoc, useFetchMock } from "../../test/helpers";

useFetchMock();

const post = {
  id: "post-1",
  slug: "hello-world",
  title: "Hello World",
  summary: "A summary",
  content: tiptapDoc("Hello"),
  html: "<p>Hello</p>",
  status: "draft",
  publishedAt: null,
  heroMediaId: "media-1",
  categories: [{ id: "cat-1", slug: "essays", title: "Essays" }],
  meta: { title: "Meta title", description: "Meta description", image: null },
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const categories = [
  { id: "cat-1", slug: "essays", title: "Essays" },
  { id: "cat-2", slug: "notes", title: "Notes" },
];

const restoredPost = {
  ...post,
  title: "Restored Title",
  summary: null,
  content: { type: "doc", content: [] },
  categories: [],
  heroMediaId: null,
  meta: { title: null, description: null, image: null },
};

const revisionSnapshot = {
  slug: post.slug,
  title: restoredPost.title,
  summary: null,
  content: restoredPost.content,
  status: "draft" as const,
  publishedAt: null,
  heroMediaId: null,
  categoryIds: [],
  meta: restoredPost.meta,
};

/** URL-routed fetch mock: request order varies with async editor startup. */
const routeContent = async (input: RequestInfo | URL): Promise<Response> => {
  const url = String(input);
  if (url.endsWith("/content/categories")) return jsonResponse(categories);
  if (url.endsWith("/restore")) return jsonResponse(restoredPost);
  if (url.endsWith("/revisions/rev-1")) return jsonResponse(revisionSnapshot);
  if (url.endsWith("/revisions")) {
    return jsonResponse([
      { id: "rev-1", createdAt: "2026-09-05T09:00:00.000Z", actor: "admin", title: "V1" },
    ]);
  }
  return jsonResponse(post);
};

const mount = (onExit: () => void) =>
  render(() => <EditorView kind="posts" slug={post.slug} onExit={onExit} />);

describe("EditorView dirty state", { timeout: 30_000 }, () => {
  it("leaves without a prompt when nothing changed", async () => {
    fetchMock.mockImplementation(routeContent);
    const onExit = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { findByLabelText, findByRole } = mount(onExit);

    await findByLabelText("Title");
    await userEvent.click(await findByRole("button", { name: /Back/, hidden: true }));

    expect(confirm).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalled();
  });

  it("warns before leaving after a body edit", async () => {
    fetchMock.mockImplementation(routeContent);
    const onExit = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { container, findByLabelText, findByRole } = mount(onExit);

    await findByLabelText("Title");
    await userEvent.click(await findByRole("button", { name: "Arena" }));
    await userEvent.type(await findByLabelText("Channel slug"), "toms-place");
    await userEvent.click(await findByRole("button", { name: "Insert" }));
    await vi.waitFor(() =>
      expect(container.querySelector('.tiptap-editor div[data-arena="toms-place"]')).not.toBeNull(),
    );

    await userEvent.click(await findByRole("button", { name: /Back/, hidden: true }));

    expect(confirm).toHaveBeenCalledWith("Discard unsaved changes?");
    expect(onExit).not.toHaveBeenCalled();
  });

  it("warns after a field edit and clears after save", async () => {
    fetchMock.mockImplementation(routeContent);
    const onExit = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { findByLabelText, findByRole, findByText } = mount(onExit);

    const title = await findByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Hello Again");
    await userEvent.click(await findByRole("button", { name: /Back/, hidden: true }));
    expect(confirm).toHaveBeenCalledWith("Discard unsaved changes?");
    expect(onExit).not.toHaveBeenCalled();

    confirm.mockClear();
    await userEvent.click(await findByRole("button", { name: "Save" }));
    await findByText("Saved");
    await userEvent.click(await findByRole("button", { name: /Back/, hidden: true }));

    expect(confirm).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalled();
  });

  it("warns after a category edit", async () => {
    fetchMock.mockImplementation(routeContent);
    const onExit = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { findByLabelText, findByRole } = mount(onExit);

    await findByLabelText("Title");
    await userEvent.click(await findByRole("button", { name: /Categories/ }));
    await userEvent.click(await findByLabelText("Notes"));
    await userEvent.click(await findByRole("button", { name: /Back/, hidden: true }));

    expect(confirm).toHaveBeenCalledWith("Discard unsaved changes?");
    expect(onExit).not.toHaveBeenCalled();
  });

  it("clears dirty state after restoring a revision", async () => {
    fetchMock.mockImplementation(routeContent);
    const onExit = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { findByLabelText, findByRole, findByText } = mount(onExit);

    await findByLabelText("Title");
    await userEvent.click(await findByRole("button", { name: "History" }));
    await userEvent.click(await findByText("V1"));
    await userEvent.click(await findByRole("button", { name: "Restore this version" }));
    await findByText("Saved");
    const restoredTitle = (await findByLabelText("Title")) as HTMLInputElement;
    await vi.waitFor(() => expect(restoredTitle.value).toBe("Restored Title"));

    confirm.mockClear();
    await userEvent.click(await findByRole("button", { name: /Back/, hidden: true }));

    expect(confirm).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalled();
  });
});
