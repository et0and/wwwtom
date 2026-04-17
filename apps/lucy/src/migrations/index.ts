import * as migration_20260401_233121 from "./20260401_233121";
import * as migration_20260402_014905 from "./20260402_014905";

export const migrations = [
  {
    up: migration_20260401_233121.up,
    down: migration_20260401_233121.down,
    name: "20260401_233121",
  },
  {
    up: migration_20260402_014905.up,
    down: migration_20260402_014905.down,
    name: "20260402_014905",
  },
];
