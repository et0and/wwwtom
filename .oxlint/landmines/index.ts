import { definePlugin } from "@oxlint/plugins";

import { colocatedTests } from "./rules/colocated-tests.ts";
import { noComments } from "./rules/no-comments.ts";
import { noExplicitReturnTypes } from "./rules/no-explicit-return-types.ts";
import { noFixedSleep } from "./rules/no-fixed-sleep.ts";
import { noFlakeMasking } from "./rules/no-flake-masking.ts";
import { noTestDoubles } from "./rules/no-test-doubles.ts";
import { noUnsignaledPoll } from "./rules/no-unsignaled-poll.ts";
import { packageExports } from "./rules/package-exports.ts";
import { strictMsw } from "./rules/strict-msw.ts";
import { testFileNames } from "./rules/test-file-names.ts";

/** Vendored from @interfere/landmines (MIT). Rules that keep tests honest. */
const landminesPlugin = definePlugin({
  meta: { name: "landmines" },
  rules: {
    "colocated-tests": colocatedTests,
    "no-comments": noComments,
    "no-explicit-return-types": noExplicitReturnTypes,
    "no-fixed-sleep": noFixedSleep,
    "no-flake-masking": noFlakeMasking,
    "no-test-doubles": noTestDoubles,
    "no-unsignaled-poll": noUnsignaledPoll,
    "package-exports": packageExports,
    "strict-msw": strictMsw,
    "test-file-names": testFileNames,
  },
});

export default landminesPlugin;
