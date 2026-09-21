import type { Definition } from "./builders";
import { ocGate } from "./definitions/actions/oc-gate";
import { setup } from "./definitions/actions/setup";
import { ci } from "./definitions/ci";
import { classifierReview } from "./definitions/classifier-review";
import { deploy } from "./definitions/deploy";
import { e2e } from "./definitions/e2e";
import { opencode } from "./definitions/opencode";
import { prComments } from "./definitions/pr-comments";
import { prReview } from "./definitions/pr-review";
import { preview } from "./definitions/preview";
import { previewStorybook } from "./definitions/preview-storybook";
import { previewSweep } from "./definitions/preview-sweep";
import { release } from "./definitions/release";
import { srht } from "./definitions/srht";

/**
 * Every generated file. The drift gate covers whichever paths are listed
 * here, so adding a workflow means adding its definition.
 */
export const definitions: ReadonlyArray<Definition> = [
  ci,
  deploy,
  e2e,
  release,
  srht,
  preview,
  previewStorybook,
  previewSweep,
  prReview,
  prComments,
  classifierReview,
  opencode,
  setup,
  ocGate,
];
