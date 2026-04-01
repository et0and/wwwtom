import * as migration_20260401_233121 from "./20260401_233121";

export const migrations = [
  {
    up: migration_20260401_233121.up,
    down: migration_20260401_233121.down,
    name: "20260401_233121",
  },
];
