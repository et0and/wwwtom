import * as GitHub from "alchemy/GitHub";
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
};

export const previewCommentBody = (apps: ReadonlyArray<PreviewApp>): string =>
  [
    "## Preview deployed",
    "",
    ...apps.map((app) => `- [${app.name}](${app.url})`),
    "",
    `Built from commit ${process.env.GITHUB_SHA?.slice(0, 7) ?? "unknown"}.`,
    "",
    "_This comment updates on each push._",
  ].join("\n");

/**
 * Post one comment with the preview URLs, updating it in place on every push.
 * A no-op outside a PR deploy.
 */
export const previewComment = ({ id, apps }: PreviewCommentProps) =>
  Effect.gen(function* () {
    const issueNumber = previewPullRequestNumber(process.env.PULL_REQUEST);
    if (Option.isNone(issueNumber)) return;

    yield* GitHub.Comment(id, {
      owner: "et0and",
      repository: "wwwtom",
      issueNumber: issueNumber.value,
      body: previewCommentBody(apps),
    });
  });
