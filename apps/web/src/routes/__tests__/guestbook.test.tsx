import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import Guestbook from "~/routes/guestbook";
import { stubAdapterFetch } from "~/test/adapter-fetch";

const fetchMock = stubAdapterFetch();

const renderGuestbook = () => {
  // No retries, so a failed read settles within the default waitFor timeout.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(() => (
    <QueryClientProvider client={client}>
      <Guestbook />
    </QueryClientProvider>
  ));
};

describe("guestbook page", () => {
  it("degrades to the signed-out and empty states when reads fail", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    renderGuestbook();

    await waitFor(() =>
      expect(screen.getByText(/Sign in with your Fediverse account/)).toBeTruthy(),
    );
    expect(screen.getByText("No signatures yet. Be the first!")).toBeTruthy();
  });
});
