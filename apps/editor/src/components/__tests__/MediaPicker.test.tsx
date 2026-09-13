import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { MediaPicker } from "../MediaPicker";
import { fetchMock, jsonResponse, listBody, media, useFetchMock } from "../../test/helpers";

useFetchMock();

describe("MediaPicker", () => {
  it("lists assets, filters by filename, and picks on click", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(listBody([media("media-1", "old.webp"), media("media-2", "new.webp")])),
    );
    const picked: Array<{ readonly id: string }> = [];
    const { findByText, findByLabelText, queryByText } = render(() => (
      <MediaPicker onPick={(item) => picked.push(item)} />
    ));
    await findByText("old.webp");
    await findByText("new.webp");
    fireEvent.input(await findByLabelText("Choose existing"), { target: { value: "new" } });
    await vi.waitFor(() => expect(queryByText("old.webp")).toBeNull());
    fireEvent.click(await findByText("new.webp"));
    expect(picked.map((item) => item.id)).toEqual(["media-2"]);
  });

  it("shows an empty state without matches", async () => {
    fetchMock.mockResolvedValue(jsonResponse(listBody([])));
    const { findByText } = render(() => <MediaPicker onPick={() => undefined} />);
    await findByText("No matching media.");
  });
});
