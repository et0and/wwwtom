import type { Generator } from "../types";
import { afterRain } from "./after-rain";
import { canon } from "./canon";
import { drift } from "./drift";
import { dust } from "./dust";
import { gust } from "./gust";
import { haze } from "./haze";
import { halo } from "./halo";
import { low } from "./low";
import { staticNoise } from "./static";

/** The pieces offered on /work/wwwork/garden, in display order. */
export const GENERATORS: readonly Generator[] = [
  drift,
  halo,
  afterRain,
  canon,
  low,
  dust,
  staticNoise,
  haze,
  gust,
];
