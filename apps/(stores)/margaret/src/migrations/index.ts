import * as migration_20260401_233121 from "./20260401_233121";
import * as migration_20260402_014905 from "./20260402_014905";
import * as migration_20260419_000000 from "./20260419_000000";
import * as migration_20260419_120000 from "./20260419_120000";
import * as migration_20260420_000000 from "./20260420_000000";

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
  {
    up: migration_20260419_000000.up,
    down: migration_20260419_000000.down,
    name: "20260419_000000",
  },
  {
    up: migration_20260419_120000.up,
    down: migration_20260419_120000.down,
    name: "20260419_120000",
  },
  {
    up: migration_20260420_000000.up,
    down: migration_20260420_000000.down,
    name: "20260420_000000",
  },
];
