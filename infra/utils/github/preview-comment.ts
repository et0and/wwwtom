import * as GitHub from "@alchemy.run/github";
import { Effect, Option, Schema } from "effect";

/**
 * A PR number from the CI env. `PULL_REQUEST` is always a string, so it is
 * decoded as one: `Schema.Int` rejects `"175"` outright, which silently
 * skipped every preview comment.
 */
const PullRequestNumber = Schema.FiniteFromString.check(Schema.isInt(), Schema.isGreaterThan(0));

/** The PR this deploy belongs to, or None when the deploy is not a PR. */
export const previewPullRequestNumber = (value: string | undefined): Option.Option<number> =>
  Option.fromNullishOr(Option.getOrUndefined(Schema.decodeUnknownOption(PullRequestNumber)(value)));

/**
 * The outcome a comment describes. A failure run reuses the same comment and
 * logical id, so a failed redeploy replaces the previous success text instead
 * of leaving stale links behind.
 */
export type PreviewStatus = "success" | "failure";

type PreviewApp = {
  readonly name: string;
  /** Absolute URL. Every preview host derives from the stage name. */
  readonly url: string;
};

type PreviewCommentProps = {
  /**
   * Alchemy resource id, and the thing that keeps the comment updating in
   * place. Required: a default id let two stacks claim one comment.
   */
  readonly id: string;
  readonly apps: ReadonlyArray<PreviewApp>;
  /** Defaults to success for stacks that never report a failure state. */
  readonly status?: PreviewStatus;
  /** CI run that failed, linked only for a failure comment. */
  readonly runUrl?: string;
};

const builtCommit = (): string => process.env.GITHUB_SHA?.slice(0, 7) ?? "unknown";

const appLinks = (apps: ReadonlyArray<PreviewApp>): ReadonlyArray<string> =>
  apps.map((app) => `- [${app.name}](${app.url})`);

export const previewCommentBody = (
  apps: ReadonlyArray<PreviewApp>,
  status: PreviewStatus = "success",
  runUrl?: string,
): string =>
  status === "failure"
    ? [
        "## Preview deploy failed",
        "",
        "The preview deploy did not update these links; they may be unavailable or still point at an older commit.",
        "",
        ...appLinks(apps),
        "",
        `Failed on commit ${builtCommit()}.`,
        ...(runUrl === undefined ? [] : ["", `[Workflow run](${runUrl})`]),
        "",
        "_This comment updates on each push._",
      ].join("\n")
    : [
        "## Preview deployed",
        "",
        ...appLinks(apps),
        "",
        `Built from commit ${builtCommit()}.`,
        "",
        "_This comment updates on each push._",
      ].join("\n");

/**
 * Post one comment with the preview URLs, updating it in place on every push.
 * A no-op outside a PR deploy.
 */
export const previewComment = ({ id, apps, status = "success", runUrl }: PreviewCommentProps) =>
  Effect.gen(function* () {
    const issueNumber = previewPullRequestNumber(process.env.PULL_REQUEST);
    if (Option.isNone(issueNumber)) return;

    yield* GitHub.Comment(id, {
      owner: "et0and",
      repository: "wwwtom",
      issueNumber: issueNumber.value,
      body: previewCommentBody(apps, status, runUrl),
    });
  });
