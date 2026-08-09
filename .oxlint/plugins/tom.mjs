import noBarrelFileRule from "./no-barrel-file.mjs";
import noReExportRule from "./no-re-export.mjs";

const plugin = {
  meta: {
    name: "tom",
  },
  rules: {
    "no-barrel-file": noBarrelFileRule,
    "no-re-export": noReExportRule,
  },
};

export default plugin;
