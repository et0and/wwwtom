import { Bollinger } from "@tom/ui/tomui/bollinger";
import type { BollingerSeries } from "@tom/ui/tomui/bollinger";

export interface PartySeries {
  color: string;
  name: string;
  points: Array<number>;
}

interface PartySeed {
  base: number;
  color: string;
  name: string;
}

export const POLL_MONTHS = [
  "Sep 25",
  "Oct 25",
  "Nov 25",
  "Dec 25",
  "Jan 26",
  "Feb 26",
  "Mar 26",
  "Apr 26",
  "May 26",
  "Jun 26",
  "Jul 26",
  "Aug 26",
  "Sep 26",
];

const PARTIES: Array<PartySeed> = [
  { base: 31, color: "#0A4DA6", name: "National" },
  { base: 28, color: "#D62027", name: "Labour" },
  { base: 10, color: "#2E9E4A", name: "Green" },
  { base: 9, color: "#3F3F46", name: "NZ First" },
  { base: 7, color: "#EAB308", name: "ACT" },
  { base: 2.5, color: "#881337", name: "Te Pāti Māori" },
];

function walkFrom(start: number, months: number): Array<number> {
  return Array.from({ length: months }, () => 0).reduce<Array<number>>(
    (points, _, month) =>
      month === 0
        ? [start]
        : [...points, Math.max(0.5, (points[month - 1] ?? start) + (Math.random() - 0.5) * 4)],
    [],
  );
}

export function generatePartyHistory(): Array<PartySeries> {
  const walks = PARTIES.map((party) => ({
    color: party.color,
    name: party.name,
    points: walkFrom(party.base, POLL_MONTHS.length),
  }));
  const totals = POLL_MONTHS.map((_, month) =>
    walks.reduce((sum, walk) => sum + (walk.points[month] ?? 0), 0),
  );
  return walks.map((walk) => ({
    color: walk.color,
    name: walk.name,
    points: walk.points.map((value, month) => (value / (totals[month] ?? 1)) * 100),
  }));
}

export function PollTrendChart(props: { history: Array<PartySeries> }) {
  const series = (): Array<BollingerSeries> =>
    props.history.map((entry) => ({
      color: entry.color,
      label: entry.name,
      values: entry.points,
    }));
  return (
    <Bollinger
      series={series()}
      labels={POLL_MONTHS}
      ariaLabel="Decided party vote over time with Bollinger bands"
      caption="Decided party vote over time, with five-poll Bollinger bands (rolling mean ± two standard deviations)."
    />
  );
}
