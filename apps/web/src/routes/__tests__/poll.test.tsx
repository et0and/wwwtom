import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@solidjs/testing-library";
import Poll, { allocateSeats } from "~/routes/poll";
import { bollinger } from "@tom/ui/tomui/bollinger";
import { generatePartyHistory } from "~/components/PollTrendChart";

const PARTY_NAMES = ["National", "Labour", "Green", "NZ First", "ACT", "Te Pāti Māori"];

const supportTable = () => screen.getByRole("table", { name: "Party support" });
const seatsTable = () => screen.getByRole("table", { name: "Projected seats" });

const columnValues = (table: HTMLElement, column: number): Array<number> =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => {
      const cells = within(row).getAllByRole("cell");
      return Number(/([\d.]+)/.exec(cells[column]?.textContent ?? "")?.[1] ?? Number.NaN);
    });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("poll math", () => {
  it("allocates all seats proportionally", () => {
    expect(allocateSeats([50, 30, 20], 120)).toEqual([60, 36, 24]);
  });

  it("holds flat bands steady", () => {
    const band = bollinger([10, 10, 10, 10, 10], 5, 2);
    expect(band).toHaveLength(5);
    for (const point of band) {
      expect(point).toEqual({ lower: 10, mid: 10, upper: 10 });
    }
  });

  it("normalizes every month to 100 percent", () => {
    const history = generatePartyHistory();
    expect(history).toHaveLength(6);
    const months = history[0]?.points.length ?? 0;
    expect(months).toBeGreaterThan(0);
    Array.from({ length: months }).forEach((_, month) => {
      const total = history.reduce((sum, entry) => sum + (entry.points[month] ?? 0), 0);
      expect(total).toBeCloseTo(100, 5);
    });
  });
});

describe("poll page", () => {
  it("renders a support row for every party", async () => {
    render(() => <Poll />);
    await waitFor(() => {
      for (const name of PARTY_NAMES) {
        expect(within(supportTable()).getByText(name)).toBeTruthy();
      }
    });
    expect(screen.getByText("Media summary statement", { selector: "h2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Spin it again" })).toBeTruthy();
  });

  it("splits 100 percent of support and 120 seats", async () => {
    render(() => <Poll />);
    await waitFor(() => expect(within(supportTable()).getAllByRole("row")).toHaveLength(7));
    const support = columnValues(supportTable(), 1).reduce((sum, value) => sum + value, 0);
    expect(support).toBeCloseTo(100, 0);
    const seats = columnValues(seatsTable(), 1).reduce((sum, value) => sum + value, 0);
    expect(seats).toBe(120);
  });

  it("spins new numbers on request", async () => {
    render(() => <Poll />);
    await waitFor(() => expect(within(supportTable()).getAllByRole("row")).toHaveLength(7));
    const before = columnValues(supportTable(), 1).join();
    fireEvent.click(screen.getByRole("button", { name: "Spin it again" }));
    await waitFor(() => expect(columnValues(supportTable(), 1).join()).not.toBe(before));
  });

  it("flashes changed values after a spin, then fades", async () => {
    const view = render(() => <Poll />);
    await waitFor(() => expect(within(supportTable()).getAllByRole("row")).toHaveLength(7));
    expect(view.container.querySelector(".poll-flash")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Spin it again" }));
    await waitFor(() =>
      expect(view.container.querySelectorAll(".poll-flash").length).toBeGreaterThan(0),
    );
    await new Promise((resolve) => setTimeout(resolve, 2200));
    expect(view.container.querySelector(".poll-flash")).toBeNull();
  });
});
