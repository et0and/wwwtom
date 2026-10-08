import type { Generator } from "../types";
import { afterRain } from "./after-rain";
import { canon } from "./canon";
import { drift } from "./drift";
import { halo } from "./halo";

/** The pieces offered on /work/seed, in display order. */
export const GENERATORS: readonly Generator[] = [drift, halo, afterRain, canon];
