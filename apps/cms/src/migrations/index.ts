import * as migration_20260210_074241_initial from "./20260210_074241_initial";

export const migrations = [
  {
    up: migration_20260210_074241_initial.up,
    down: migration_20260210_074241_initial.down,
    name: "20260210_074241_initial",
  },
];
