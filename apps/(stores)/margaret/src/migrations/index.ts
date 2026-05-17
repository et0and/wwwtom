import * as migration_20260401_233121 from "./20260401_233121";
import * as migration_20260402_014905 from "./20260402_014905";
import * as migration_20260419_000000 from "./20260419_000000";
import * as migration_20260419_120000 from "./20260419_120000";
import * as migration_20260420_000000 from "./20260420_000000";
import * as migration_20260505_111800 from "./20260505_111800";
import * as migration_20260517_000001 from "./20260517_000001";
import * as migration_20260517_000002 from "./20260517_000002";
import * as migration_20260517_000003 from "./20260517_000003";

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
  {
    up: migration_20260505_111800.up,
    down: migration_20260505_111800.down,
    name: "20260505_111800",
  },
  {
    up: migration_20260517_000001.up,
    down: migration_20260517_000001.down,
    name: "20260517_000001",
  },
  {
    up: migration_20260517_000002.up,
    down: migration_20260517_000002.down,
    name: "20260517_000002",
  },
  {
    up: migration_20260517_000003.up,
    down: migration_20260517_000003.down,
    name: "20260517_000003",
  },
];
