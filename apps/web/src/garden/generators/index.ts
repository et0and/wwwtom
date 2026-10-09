import type { Generator } from "../types";
import { afterRain } from "./after-rain";
import { canon } from "./canon";
import { drift } from "./drift";
import { dust } from "./dust";
import { halo } from "./halo";
import { low } from "./low";

/** The pieces offered on /work/wwwork/garden, in display order. */
export const GENERATORS: readonly Generator[] = [drift, halo, afterRain, canon, low, dust];
