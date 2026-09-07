import { For, Show, createMemo, createSignal, onSettled } from "solid-js";
import { PageLayout } from "@tom/ui/PageLayout";
import { Spinner } from "@tom/ui/Spinner";
import { Button } from "@tom/ui/tomui/button";
import { BlurInSection } from "~/components/BlurInSection";
import { BlurInText } from "~/components/BlurInText";
import { PollTrendChart, generatePartyHistory } from "~/components/PollTrendChart";
import type { PartySeries } from "~/components/PollTrendChart";

const HEADLINE_MONTH = "September 2026";
const PREVIOUS_MONTH = "August 2026";
const HEADLINE_DATES = "Tuesday 01 September to Friday 04 September 2026";
const PARLIAMENT_SEATS = 120;

const GOVERNMENT_BLOC = ["National", "NZ First", "ACT"];
const OPPOSITION_BLOC = ["Labour", "Green", "Te Pāti Māori"];

export function allocateSeats(shares: Array<number>, totalSeats: number): Array<number> {
  const quotas = shares.map((share) => (share / 100) * totalSeats);
  const floors = quotas.map((quota) => Math.floor(quota));
  const leftover = Math.max(0, totalSeats - floors.reduce((sum, seats) => sum + seats, 0));
  const priority = quotas
    .map((quota, index) => index)
    .sort((a, b) => (quotas[b] ?? 0) - (quotas[a] ?? 0))
    .slice(0, leftover);
  return floors.map((seats, index) => seats + (priority.includes(index) ? 1 : 0));
}

function formatPoints(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatChange(delta: number): string {
  if (Math.abs(delta) < 0.05) return "NC";
  return delta > 0 ? `↑${Math.abs(delta).toFixed(1)}` : `↓${Math.abs(delta).toFixed(1)}`;
}

function supportClause(name: string, share: number, delta: number): string {
  if (Math.abs(delta) < 0.05) return `${name} is unchanged on ${formatPoints(share)}.`;
  if (delta > 0)
    return `${name} is up ${Math.abs(delta).toFixed(1)} points to ${formatPoints(share)}.`;
  return `${name} is down ${Math.abs(delta).toFixed(1)} points to ${formatPoints(share)}.`;
}

function seatClause(name: string, seats: number, delta: number): string {
  if (delta === 0) return `${name} is unchanged on ${seats} seats.`;
  if (delta > 0) return `${name} gains ${delta} to ${seats}.`;
  return `${name} drops ${Math.abs(delta)} to ${seats}.`;
}

export default function Poll() {
  const [history, setHistory] = createSignal<Array<PartySeries>>([]);
  // onSettled is a no-op during SSR, so the numbers only materialize in the
  // browser — the server and the first client render agree on the placeholder.
  onSettled(() => {
    setHistory(generatePartyHistory());
  });

  const headline = createMemo(() =>
    history().map((entry) => entry.points[entry.points.length - 1] ?? 0),
  );
  const previous = createMemo(() =>
    history().map((entry) => entry.points[entry.points.length - 2] ?? 0),
  );
  const deltas = createMemo(() =>
    headline().map((share, index) => share - (previous()[index] ?? 0)),
  );
  const seats = createMemo(() => allocateSeats(headline(), PARLIAMENT_SEATS));
  const previousSeats = createMemo(() => allocateSeats(previous(), PARLIAMENT_SEATS));
  const seatDeltas = createMemo(() =>
    seats().map((count, index) => count - (previousSeats()[index] ?? 0)),
  );
  const blocSeats = createMemo(() => {
    const names = history().map((entry) => entry.name);
    const government = names.reduce(
      (sum, name, index) => sum + (GOVERNMENT_BLOC.includes(name) ? (seats()[index] ?? 0) : 0),
      0,
    );
    const opposition = names.reduce(
      (sum, name, index) => sum + (OPPOSITION_BLOC.includes(name) ? (seats()[index] ?? 0) : 0),
      0,
    );
    return { government, opposition };
  });
  const governmentVerdict = createMemo(() => {
    if (blocSeats().government >= 61)
      return "On these numbers, the current three parties of Government would be able to form a Government.";
    if (blocSeats().opposition >= 61)
      return "On these numbers, the Opposition bloc would be able to form a Government.";
    return "On these numbers, neither bloc commands a majority in Parliament.";
  });

  const refresh = () => {
    setHistory(generatePartyHistory());
  };

  return (
    <PageLayout
      title="Doodoo Dynamics Market Research Poll"
      description="September 2026 Doodoo Dynamics Market Research Poll: party vote, seat projection, and trend bands"
      canonical="https://tom.so/poll"
    >
      <BlurInText
        text={`Doodoo Dynamics Market Research Poll: ${HEADLINE_MONTH}`}
        tag="h1"
        baseDelay={0.1}
        step={0.025}
      />
      <BlurInSection delay={0.3}>
        <p>Here are the headline results for September's Doodoo Dynamics Market Research Poll:</p>
      </BlurInSection>
      <BlurInSection delay={0.5}>
        <Show when={history().length > 0} fallback={<Spinner color="grey" />}>
          <div class="space-y-8">
            <PollTrendChart history={history()} />
            <section class="space-y-4">
              <h2>Party vote</h2>
              <table aria-label="Party support" class="w-full border-collapse text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="px-3 py-2 text-left font-semibold">Party</th>
                    <th class="px-3 py-2 text-right font-semibold">Support</th>
                    <th class="px-3 py-2 text-right font-semibold">
                      Change compared to {PREVIOUS_MONTH}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={history()}>
                    {(entry, index) => (
                      <tr class="border-b">
                        <td class="px-3 py-2">{entry.name}</td>
                        <td class="px-3 py-2 text-right tabular-nums">
                          {formatPoints(headline()[index()] ?? 0)}
                        </td>
                        <td class="px-3 py-2 text-right font-semibold">
                          {formatChange(deltas()[index()] ?? 0)}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
              <div class="space-y-2">
                <For each={history()}>
                  {(entry, index) => (
                    <p>
                      {supportClause(entry.name, headline()[index()] ?? 0, deltas()[index()] ?? 0)}
                    </p>
                  )}
                </For>
              </div>
            </section>
            <section class="space-y-4">
              <h2>Seat projection</h2>
              <p>
                This shows how many seats each party would win in Parliament, based on the decided
                vote.
              </p>
              <table aria-label="Projected seats" class="w-full border-collapse text-sm">
                <thead>
                  <tr class="border-b">
                    <th class="px-3 py-2 text-left font-semibold">Party</th>
                    <th class="px-3 py-2 text-right font-semibold">Seats</th>
                    <th class="px-3 py-2 text-right font-semibold">
                      Change compared to {PREVIOUS_MONTH}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={history()}>
                    {(entry, index) => (
                      <tr class="border-b">
                        <td class="px-3 py-2">{entry.name}</td>
                        <td class="px-3 py-2 text-right tabular-nums">{seats()[index()] ?? 0}</td>
                        <td class="px-3 py-2 text-right font-semibold">
                          {formatChange(seatDeltas()[index()] ?? 0)}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
              <div class="space-y-2">
                <For each={history()}>
                  {(entry, index) => (
                    <p>
                      {seatClause(entry.name, seats()[index()] ?? 0, seatDeltas()[index()] ?? 0)}
                    </p>
                  )}
                </For>
              </div>
            </section>
            <section class="space-y-4">
              <h2>The blocs</h2>
              <p>
                The combined projected seats for the Government Parties Bloc (National, New Zealand
                First, ACT) is {blocSeats().government}.
              </p>
              <p>
                The combined seats for the Opposition Parties Bloc (Labour, Green, Te Pāti Māori) is{" "}
                {blocSeats().opposition}.
              </p>
              <p>{governmentVerdict()}</p>
            </section>
            <section class="space-y-4">
              <h2>Media summary statement</h2>
              <p>
                This poll should be formally referred to as the "Doodoo Dynamics Market Research
                Poll".
              </p>
              <p>
                <em>
                  The poll was conducted by Doodoo Dynamics Market Research Ltd. It is a random poll
                  of 1,000 adult New Zealanders and is weighted to the overall adult population. It
                  was conducted by phone (landlines and mobile) and online between {HEADLINE_DATES},
                  has a maximum margin of error of ±3.1% and 2.1% were undecided on the party vote
                  question.
                </em>
              </p>
              <h2>Notes</h2>
              <p>
                The scientific poll was conducted by Doodoo Dynamics Market Research and
                commissioned by nobody in particular. The target population is adults aged 18+ who
                live in New Zealand and are eligible and likely to vote. 1,000 respondents agreed to
                participate, 700 by phone and 300 by online panel. The number of decided voters on
                the vote questions was 965.
              </p>
              <p>
                For seat projections it is assumed all current parliamentary parties will win at
                least one electorate seat and be eligible for list MPs. However no overhang seats
                are assumed or projected.
              </p>
              <p>
                The results are weighted to reflect the overall voting adult population in terms of
                gender, age, and area. Based on this sample of 1,000 respondents, the maximum
                sampling error (for a result of 50%) is ±3.1%, at the 95% confidence level.
              </p>
            </section>
            <Button type="button" variant="primary" onClick={refresh}>
              Spin it again
            </Button>
          </div>
        </Show>
      </BlurInSection>
    </PageLayout>
  );
}
