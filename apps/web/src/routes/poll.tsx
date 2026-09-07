import { For, Show, createMemo, createSignal, onCleanup, onSettled } from "solid-js";
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

function supportVerb(delta: number): string {
  if (Math.abs(delta) < 0.05) return "is unchanged on";
  if (delta > 0) return `is up ${Math.abs(delta).toFixed(1)} points to`;
  return `is down ${Math.abs(delta).toFixed(1)} points to`;
}

export interface Methodology {
  decided: number;
  moe: number;
  online: number;
  phone: number;
  refused: number;
  sample: number;
  undecided: number;
}

const EMPTY_METHODOLOGY: Methodology = {
  decided: 0,
  moe: 0,
  online: 0,
  phone: 0,
  refused: 0,
  sample: 0,
  undecided: 0,
};

export function generateMethodology(): Methodology {
  const sample = 980 + Math.floor(Math.random() * 41);
  const phone = Math.round(sample * (0.65 + Math.random() * 0.1));
  const online = sample - phone;
  const undecided = Math.round((1.8 + Math.random() * 0.8) * 10) / 10;
  const refused = Math.round((1 + Math.random() * 0.6) * 10) / 10;
  const decided =
    sample - Math.round((sample * undecided) / 100) - Math.round((sample * refused) / 100);
  const moe = Math.round(1.96 * Math.sqrt(0.25 / sample) * 1000) / 10;
  return { decided, moe, online, phone, refused, sample, undecided };
}

function formatCount(value: number): string {
  return value.toLocaleString("en-NZ");
}

const FLASH_ON = "poll-flash bg-amber-200 dark:bg-amber-900/60";

function seatChange(delta: number): string {
  if (delta === 0) return "no change";
  if (delta > 0) return `up ${delta}`;
  return `down ${Math.abs(delta)}`;
}

function changedIndexes<T>(nextValues: Array<T>, prevValues: Array<T>): Array<number> {
  return nextValues
    .map((_, index) => index)
    .filter((index) => nextValues[index] !== prevValues[index]);
}

interface FlashTimerRef {
  current: ReturnType<typeof setTimeout> | undefined;
}

export default function Poll() {
  const [history, setHistory] = createSignal<Array<PartySeries>>([]);
  const [methodology, setMethodology] = createSignal<Methodology>(EMPTY_METHODOLOGY);
  const [flashedSupport, setFlashedSupport] = createSignal<Array<number>>([]);
  const [flashedSeats, setFlashedSeats] = createSignal<Array<number>>([]);
  const [flashedMethod, setFlashedMethod] = createSignal<Array<keyof Methodology>>([]);
  const flashTimer: FlashTimerRef = { current: undefined };
  // onSettled is a no-op during SSR, so the numbers only materialize in the
  // browser — the server and the first client render agree on the placeholder.
  onSettled(() => {
    setHistory(generatePartyHistory());
    setMethodology(generateMethodology());
  });
  onCleanup(() => {
    if (flashTimer.current !== undefined) clearTimeout(flashTimer.current);
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
    const beforeShares = headline().map((share) => share.toFixed(1));
    const beforeSeats = seats();
    const beforeMethod = methodology();
    const next = generatePartyHistory();
    const nextShares = next.map((entry) => (entry.points[entry.points.length - 1] ?? 0).toFixed(1));
    const nextSeats = allocateSeats(
      next.map((entry) => entry.points[entry.points.length - 1] ?? 0),
      PARLIAMENT_SEATS,
    );
    const nextMethod = generateMethodology();
    setHistory(next);
    setMethodology(nextMethod);
    if (flashTimer.current !== undefined) clearTimeout(flashTimer.current);
    setFlashedSupport(changedIndexes(nextShares, beforeShares));
    setFlashedSeats(changedIndexes(nextSeats, beforeSeats));
    setFlashedMethod(
      (Object.keys(nextMethod) as Array<keyof Methodology>).filter(
        (key) => nextMethod[key] !== beforeMethod[key],
      ),
    );
    flashTimer.current = setTimeout(() => {
      setFlashedSupport([]);
      setFlashedSeats([]);
      setFlashedMethod([]);
    }, 1600);
  };

  const supportCellClass = (index: number): string =>
    `px-3 py-2 text-right tabular-nums transition-colors duration-1000 ${flashedSupport().includes(index) ? FLASH_ON : ""}`;

  const seatsCellClass = (index: number): string =>
    `px-3 py-2 text-right tabular-nums transition-colors duration-1000 ${flashedSeats().includes(index) ? FLASH_ON : ""}`;

  const flashText = (flashed: boolean): string =>
    `transition-colors duration-1000 ${flashed ? FLASH_ON : ""}`;

  const methodFlash = (key: keyof Methodology): string => flashText(flashedMethod().includes(key));

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
                        <td class={supportCellClass(index())}>
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
                      {entry.name} {supportVerb(deltas()[index()] ?? 0)}{" "}
                      <span class={flashText(flashedSupport().includes(index()))}>
                        {formatPoints(headline()[index()] ?? 0)}
                      </span>
                      .
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
                        <td class={seatsCellClass(index())}>{seats()[index()] ?? 0}</td>
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
                      {entry.name} wins{" "}
                      <span class={flashText(flashedSeats().includes(index()))}>
                        {seats()[index()] ?? 0}
                      </span>{" "}
                      seats ({seatChange(seatDeltas()[index()] ?? 0)}).
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
                  of <span class={methodFlash("sample")}>{formatCount(methodology().sample)}</span>{" "}
                  adult New Zealanders and is weighted to the overall adult population. It was
                  conducted by phone (landlines and mobile) and online between {HEADLINE_DATES}, has
                  a maximum margin of error of{" "}
                  <span class={methodFlash("moe")}>±{methodology().moe.toFixed(1)}%</span> and{" "}
                  <span class={methodFlash("undecided")}>
                    {methodology().undecided.toFixed(1)}%
                  </span>{" "}
                  were undecided on the party vote question.
                </em>
              </p>
              <h2>Notes</h2>
              <p>
                The scientific poll was conducted by Doodoo Dynamics Market Research and
                commissioned by nobody in particular. The target population is adults aged 18+ who
                live in New Zealand and are eligible and likely to vote.{" "}
                <span class={methodFlash("sample")}>{formatCount(methodology().sample)}</span>{" "}
                respondents agreed to participate,{" "}
                <span class={methodFlash("phone")}>{formatCount(methodology().phone)}</span> by
                phone and{" "}
                <span class={methodFlash("online")}>{formatCount(methodology().online)}</span> by
                online panel. The number of decided voters on the vote questions was{" "}
                <span class={methodFlash("decided")}>{formatCount(methodology().decided)}</span>.
              </p>
              <p>
                For seat projections it is assumed all current parliamentary parties will win at
                least one electorate seat and be eligible for list MPs. However no overhang seats
                are assumed or projected.
              </p>
              <p>
                The results are weighted to reflect the overall voting adult population in terms of
                gender, age, and area. Based on this sample of{" "}
                <span class={methodFlash("sample")}>{formatCount(methodology().sample)}</span>{" "}
                respondents, the maximum sampling error (for a result of 50%) is{" "}
                <span class={methodFlash("moe")}>±{methodology().moe.toFixed(1)}%</span>, at the 95%
                confidence level.
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
